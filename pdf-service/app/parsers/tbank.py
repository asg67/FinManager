"""T-Bank (Tinkoff) card statement PDF parser.

Handles T-Bank card/checking account statements.
Typical columns: Дата операции, Дата платежа, Номер карты, Статус,
  Сумма операции, Валюта, Сумма платежа, Валюта, Кэшбэк, Категория, MCC, Описание.
Alternative format: Дата, Операция, Сумма, Остаток.

Falls back to text-based row parsing (like ZFBirdy bot) if header-based
extraction returns 0 transactions.
"""

import re
import pdfplumber
from io import BytesIO
from typing import Any, Optional

from .utils import normalize_amount, parse_date, parse_time, clean_text

NBSP = "\u00a0"
_DATE_RE = re.compile(r"\b(\d{2}\.\d{2}\.\d{4})\b")
_TIME_RE = re.compile(r"\b(\d{2}:\d{2})(?::(\d{2}))?\b")
_AMOUNT_RE = re.compile(r"([+-])\s*([\d\s]+(?:[.,]\s*\d(?:\s*\d)?)?)\s*₽")
_SERVICE_RE = re.compile(
    r"^(Пополнения:|Расходы:|Итого|Исходящий остаток|С уважением|Руководитель)", re.I
)


def parse_tbank(pdf_bytes: bytes) -> dict[str, Any]:
    """Parse a T-Bank card/checking PDF statement."""
    transactions: list[dict[str, Any]] = []
    card_code = None

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            # Extract card code from text
            if not card_code:
                text = page.extract_text() or ""
                card_code = _extract_card_code(text)

            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue

                header = _normalize_header(table[0])
                if not header:
                    continue

                for row in table[1:]:
                    if not row or len(row) < len(header):
                        continue

                    # Try to extract card code from "Номер карты" column
                    if not card_code and 'card_number' in header:
                        raw_card = (row[header['card_number']] or '').strip()
                        if raw_card:
                            card_code = raw_card

                    tx = _parse_row(header, row)
                    if tx:
                        transactions.append(tx)

    # Fallback: text-based parsing if header-based found nothing
    if not transactions:
        transactions = _parse_text_based(pdf_bytes)

    return {
        "transactions": transactions,
        "account_identifier": card_code,
    }


# ========== Text-based fallback (from ZFBirdy bot approach) ==========

def _norm(s: str) -> str:
    return re.sub(r"\s{2,}", " ", (s or "").replace(NBSP, " ").strip())


def _fix_decimal_gaps(txt: str) -> str:
    """Fix spaced decimals like ', 7 2' before ₽ sign."""
    return re.sub(r"([.,])\s*(\d)\s+(\d)(?=\s*₽)", r"\1\2\3", txt)


def _parse_amount_tbank(txt: str) -> tuple[Optional[str], Optional[float]]:
    txt = _fix_decimal_gaps(txt)
    m = _AMOUNT_RE.search(txt)
    if not m:
        return None, None
    sign = m.group(1)
    val = float(m.group(2).replace(" ", "").replace(",", "."))
    return sign, val


def _clean_purpose_tbank(s: str) -> str:
    s = re.sub(r"\b\d{2}\.\d{2}\.\d{4}\b", "", s)
    s = re.sub(r"\b\d{2}:\d{2}(?::\d{2})?\b", "", s)
    s = re.sub(r"\bНомер карты\b\s*\d{3,}", "", s, flags=re.I)
    return _norm(s)


def _counterparty_from_desc(purpose: str) -> Optional[str]:
    m = re.search(r"по\s+номеру\s+телефона\s*(\+?\d[\d\s\-]{6,})", purpose, flags=re.I)
    if m:
        return re.sub(r"\s+", "", m.group(1))
    m = re.search(r"договор\s+(\d+)", purpose, flags=re.I)
    if m:
        return f"Договор {m.group(1)}"
    m = re.search(r"сч[её]т\s+(\d+)", purpose, flags=re.I)
    if m:
        return f"Счёт {m.group(1)}"
    if "Проценты на остаток" in purpose:
        return "АО «ТБанк»"
    return None


def _parse_text_based(pdf_bytes: bytes) -> list[dict[str, Any]]:
    """Parse T-Bank statement by joining table cells into text lines
    and extracting date + amount with ₽ sign via regex."""
    all_tables: list[list[list[str]]] = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables(
                table_settings={"vertical_strategy": "lines", "horizontal_strategy": "lines"}
            )
            if not tables:
                tables = page.extract_tables(
                    table_settings={"vertical_strategy": "text", "horizontal_strategy": "text"}
                )
            for t in (tables or []):
                all_tables.append(t)

    ops = _parse_tables_to_ops(all_tables)
    transactions: list[dict[str, Any]] = []

    for date_ru, time_str, sign, amount, purpose in ops:
        dt = parse_date(date_ru)
        if not dt:
            continue
        counterparty = _counterparty_from_desc(purpose)
        transactions.append({
            "date": dt.isoformat(),
            "time": time_str,
            "amount": str(amount),
            "direction": "income" if sign == "+" else "expense",
            "counterparty": counterparty,
            "purpose": purpose if purpose else None,
            "balance": None,
        })

    return transactions


def _parse_tables_to_ops(
    all_tables: list[list[list[str]]],
) -> list[tuple[str, str, str, float, str]]:
    """Extract (date_ru, time_str, sign, amount, purpose) from table rows."""
    ops: list[tuple[str, str, str, float, str]] = []
    for t in all_tables:
        rows = [_norm(" ".join([(c or "") for c in row])) for row in t]
        i = 0
        while i < len(rows):
            line = rows[i]
            mdate = _DATE_RE.search(line)
            if not mdate:
                i += 1
                continue
            date_ru = mdate.group(1)

            mtime = _TIME_RE.search(line)
            time_str = mtime.group(1) if mtime else None

            # Collect block lines until next date or service marker
            block = [line]
            j = i + 1
            while j < len(rows):
                ln = rows[j]
                if _DATE_RE.search(ln) or _SERVICE_RE.search(ln):
                    break
                if not time_str:
                    m2 = _TIME_RE.search(ln)
                    if m2:
                        time_str = m2.group(1)
                block.append(ln)
                j += 1

            text = _norm(" ".join(block))
            sign, amount = _parse_amount_tbank(text)
            if sign is not None and amount is not None:
                purpose = _clean_purpose_tbank(
                    re.sub(_AMOUNT_RE, "", _fix_decimal_gaps(text))
                )
                if not time_str:
                    time_str = "00:00"
                ops.append((date_ru, time_str, sign, amount, purpose))
            i = j if j > i else i + 1
    return ops


# ========== Header-based parser helpers ==========

def _extract_card_code(text: str) -> str | None:
    """Extract T-Bank card code/number from page text."""
    # Look for card number patterns: *1234, ** 1234, карта *1234
    match = re.search(r'[*]{1,2}\s*(\d{4})', text)
    if match:
        return '*' + match.group(1)
    # Look for full card number masked: 5213 68** **** 1234
    match = re.search(r'\d{4}\s*\d{2}\*{2}\s*\*{4}\s*(\d{4})', text)
    if match:
        return '*' + match.group(1)
    return None


def _normalize_header(row: list[str | None]) -> dict[str, int] | None:
    """Map column names to indices."""
    if not row:
        return None

    mapping: dict[str, int] = {}
    for i, cell in enumerate(row):
        if not cell:
            continue
        cell_lower = cell.strip().lower().replace('\n', ' ')

        if 'дата операц' in cell_lower or (cell_lower == 'дата' and 'date' not in mapping):
            mapping['date'] = i
        elif 'дата платеж' in cell_lower or 'дата списан' in cell_lower:
            mapping['date_posted'] = i
        elif 'сумма операц' in cell_lower or ('сумма' in cell_lower and 'amount' not in mapping):
            mapping['amount'] = i
        elif 'сумма платеж' in cell_lower:
            mapping['payment_amount'] = i
        elif 'описание' in cell_lower or 'операция' in cell_lower or 'назначение' in cell_lower:
            mapping['description'] = i
        elif 'категория' in cell_lower:
            mapping['category'] = i
        elif 'остаток' in cell_lower:
            mapping['balance'] = i
        elif 'статус' in cell_lower:
            mapping['status'] = i
        elif 'номер карты' in cell_lower or 'карта' in cell_lower:
            mapping['card_number'] = i
        elif 'mcc' in cell_lower:
            mapping['mcc'] = i
        elif 'кэшбэк' in cell_lower or 'cashback' in cell_lower:
            mapping['cashback'] = i

    if 'date' not in mapping:
        return None
    if 'amount' not in mapping and 'payment_amount' not in mapping:
        return None

    return mapping


def _parse_row(header: dict[str, int], row: list[str | None]) -> dict[str, Any] | None:
    """Parse a single table row."""
    date_raw = row[header['date']] if 'date' in header else None
    dt = parse_date(date_raw)
    if not dt:
        return None

    # Skip non-completed transactions
    if 'status' in header:
        status = (row[header['status']] or '').strip().lower()
        if status and status not in ['ok', 'выполнена', 'проведена', '']:
            return None

    # Get amount (prefer payment_amount if available, otherwise amount)
    amount_key = 'payment_amount' if 'payment_amount' in header else 'amount'
    raw_amount = normalize_amount(row[header[amount_key]])
    if not raw_amount:
        return None

    if raw_amount < 0:
        direction = "expense"
        amount = abs(raw_amount)
    else:
        direction = "income"
        amount = raw_amount

    description = clean_text(row[header['description']]) if 'description' in header else None
    category = clean_text(row[header.get('category', -1)]) if 'category' in header else None
    balance = normalize_amount(row[header.get('balance', -1)]) if 'balance' in header else None

    time_str = parse_time(date_raw)

    # Use description as counterparty for card transactions
    counterparty = description
    purpose = category

    return {
        "date": dt.isoformat(),
        "time": time_str,
        "amount": str(amount),
        "direction": direction,
        "counterparty": counterparty,
        "purpose": purpose,
        "balance": str(balance) if balance is not None else None,
    }
