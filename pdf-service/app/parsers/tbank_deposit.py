"""T-Bank deposit/savings account PDF parser.

Handles T-Bank deposit (вклад/накопительный счёт) statements.
Typically simpler format: Дата, Операция, Сумма, Остаток.

Falls back to text-based row parsing (like regular T-Bank parser)
if header-based extraction returns 0 transactions.
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


def parse_tbank_deposit(pdf_bytes: bytes) -> dict[str, Any]:
    """Parse a T-Bank deposit statement PDF."""
    transactions: list[dict[str, Any]] = []
    contract_number = None

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            # Extract contract number from text
            if not contract_number:
                text = page.extract_text() or ""
                contract_number = _extract_contract_number(text)

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

                    tx = _parse_row(header, row)
                    if tx:
                        transactions.append(tx)

    # Fallback: text-based parsing if header-based found nothing
    if not transactions:
        transactions = _parse_text_based(pdf_bytes)

    return {
        "transactions": transactions,
        "account_identifier": contract_number,
    }


def _extract_contract_number(text: str) -> str | None:
    """Extract T-Bank deposit contract number from page text."""
    import re
    # "Номер договора" / "Договор №" / "договор" patterns
    match = re.search(r'(?:номер\s*договора|договор\s*[№#]?)\s*[:\s]*(\S+)', text, re.IGNORECASE)
    if match:
        val = match.group(1).strip().rstrip('.')
        if val:
            return val
    # Account number pattern (20 digits)
    match = re.search(r'\b(42\d{18})\b', text)
    if match:
        return match.group(1)
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

        if 'дата' in cell_lower and 'date' not in mapping:
            mapping['date'] = i
        elif any(k in cell_lower for k in ['приход', 'зачисление', 'кредит']):
            mapping['credit'] = i
        elif any(k in cell_lower for k in ['расход', 'списание', 'дебет']):
            mapping['debit'] = i
        elif 'сумма' in cell_lower and 'amount' not in mapping:
            mapping['amount'] = i
        elif any(k in cell_lower for k in ['операция', 'описание', 'назначение', 'основание']):
            mapping['description'] = i
        elif 'остаток' in cell_lower or 'баланс' in cell_lower:
            mapping['balance'] = i

    if 'date' not in mapping:
        return None
    if not any(k in mapping for k in ['credit', 'debit', 'amount']):
        return None

    return mapping


def _parse_row(header: dict[str, int], row: list[str | None]) -> dict[str, Any] | None:
    """Parse a single table row."""
    date_raw = row[header['date']] if 'date' in header else None
    dt = parse_date(date_raw)
    if not dt:
        return None

    direction = "unknown"
    amount = None

    if 'credit' in header and 'debit' in header:
        credit = normalize_amount(row[header['credit']])
        debit = normalize_amount(row[header['debit']])
        if credit and credit > 0:
            amount = credit
            direction = "income"
        elif debit and debit > 0:
            amount = debit
            direction = "expense"
        else:
            return None
    elif 'amount' in header:
        raw_amount = normalize_amount(row[header['amount']])
        if not raw_amount:
            return None
        if raw_amount < 0:
            amount = abs(raw_amount)
            direction = "expense"
        else:
            amount = raw_amount
            direction = "income"
    else:
        return None

    description = clean_text(row[header.get('description', -1)]) if 'description' in header else None
    balance = normalize_amount(row[header.get('balance', -1)]) if 'balance' in header else None
    time_str = parse_time(date_raw)

    # For deposit statements, description doubles as purpose
    purpose = description
    counterparty = None

    # Try to infer from description
    if description:
        desc_lower = description.lower()
        if 'процент' in desc_lower or '%' in description:
            counterparty = "Начисление процентов"
        elif 'пополнение' in desc_lower or 'перевод' in desc_lower:
            counterparty = "Пополнение"
        elif 'списание' in desc_lower or 'вывод' in desc_lower:
            counterparty = "Списание"

    return {
        "date": dt.isoformat(),
        "time": time_str,
        "amount": str(amount),
        "direction": direction,
        "counterparty": counterparty,
        "purpose": purpose,
        "balance": str(balance) if balance is not None else None,
    }


# ========== Text-based fallback (same approach as tbank.py) ==========

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
    if not purpose:
        return None
    purpose_lower = purpose.lower()
    if "процент" in purpose_lower or "%" in purpose:
        return "Начисление процентов"
    if "пополнение" in purpose_lower or "перевод" in purpose_lower:
        return "Пополнение"
    if "списание" in purpose_lower or "вывод" in purpose_lower:
        return "Списание"
    m = re.search(r"по\s+номеру\s+телефона\s*(\+?\d[\d\s\-]{6,})", purpose, flags=re.I)
    if m:
        return re.sub(r"\s+", "", m.group(1))
    m = re.search(r"договор\s+(\d+)", purpose, flags=re.I)
    if m:
        return f"Договор {m.group(1)}"
    return None


def _parse_text_based(pdf_bytes: bytes) -> list[dict[str, Any]]:
    """Parse T-Bank deposit statement by joining table cells into text lines
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
