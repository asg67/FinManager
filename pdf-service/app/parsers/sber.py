"""Sber bank statement PDF parser.

Handles both:
- Sber business (ИП/ООО) account statements (table-based)
- Sber personal account statements (text-based, line-by-line)
"""

import re
import pdfplumber
from io import BytesIO
from typing import Any, Optional

from .utils import normalize_amount, parse_date, parse_time, clean_text

# --- Constants for text-based personal statement parser ---
NBSP = "\u00a0"
_SP = rf"[ {NBSP}]"
_NUM = rf"(?:\d|{_SP})+"
_DEC = rf"{_NUM}(?:[.,]\s*\d(?:\s*\d)?)?"""

# Line starting with "DD.MM.YYYY HH:MM" marks a new transaction block
_DATE_HEAD_RE = re.compile(rf"^(\d{{2}}\.\d{{2}}\.\d{{4}}){_SP}+(\d{{2}}:\d{{2}})\b")

# Full header line: date time code category [sign]amount [balance]
_HEADER_PARSE_RE = re.compile(
    rf"""^(?P<date>\d{{2}}\.\d{{2}}\.\d{{4}}){_SP}+
    (?P<time>\d{{2}}:\d{{2}}){_SP}+
    (?P<code>\d+){_SP}+
    (?P<category>.+?)\s+
    (?P<sign>[+\-\u2212\u2013]?)\s*(?P<amount>{_DEC})
    (?:\s+(?P<balance>{_DEC}))?\s*$""",
    re.X,
)

_BALANCE_LABELS_RE = re.compile(
    r"(ОСТАТОК( СРЕДСТВ)?|Итого по операциям|Продолжение на следующей странице|"
    r"Выписка по плат[ёе]жному сч[её]ту)",
    re.I,
)
_REMOVE_BITS_RE = re.compile(
    r"(Дата обработки\s*\d{2}:\d{2}\s*\d+|код авторизации\s*\d+|"
    r"Операция по\s+(сч[её]ту|карте)\s*\*+\d+)",
    re.I,
)
_REMOVE_DATES_TIMES_RE = re.compile(
    r"(\b\d{2}\.\d{2}\.\d{4}\b|\b\d{2}:\d{2}(?::\d{2})?\b)"
)


def parse_sber(pdf_bytes: bytes) -> dict[str, Any]:
    """Parse a Sber PDF statement and return transactions + account identifier.

    Tries table-based extraction first (business statements).
    Falls back to text-based line parsing (personal statements).
    """
    transactions: list[dict[str, Any]] = []
    account_id = None

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        # Extract account number from text on first pages
        for page in pdf.pages[:3]:
            text = page.extract_text() or ""
            if not account_id:
                account_id = _extract_account_number(text)

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

        # Process remaining pages (tables only)
        for page in pdf.pages[3:]:
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

    # Fallback: if table extraction found nothing, try text-based parsing
    if not transactions:
        transactions = _parse_text_based(pdf_bytes)

    return {
        "transactions": transactions,
        "account_identifier": account_id,
    }


# ========== Text-based parser for personal statements ==========

def _norm(s: Optional[str]) -> str:
    if s is None:
        return ""
    s = s.replace(NBSP, " ")
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()


def _fix_decimals(txt: str) -> str:
    """Fix split decimals like '. 0 0' or ', 7 2' → '.00', ',72'."""
    return re.sub(r"([.,])\s*(\d)\s+(\d)", r"\1\2\3", txt)


def _to_float(s: Optional[str]) -> Optional[float]:
    if not s:
        return None
    cleaned = _fix_decimals(s).replace(" ", "").replace(NBSP, "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _clean_purpose(text: str) -> str:
    t = _REMOVE_BITS_RE.sub("", text)
    t = _REMOVE_DATES_TIMES_RE.sub("", t)
    t = _BALANCE_LABELS_RE.sub("", t)
    return _norm(t)


_CP_PAT = re.compile(
    r"(?:перевод\s+для|перевод\s+от)\s+(.+?)"
    r"(?:(?:\.\s*)?(?:операц|по счету|по сч[её]ту)\b|$)",
    re.I,
)


def _counterparty_sber(text: str) -> Optional[str]:
    t = _norm(text)
    m = _CP_PAT.search(t)
    if not m:
        return None
    name = m.group(1)
    name = re.sub(r"\s*по\s+сч[её]ту\s*\*+\d+.*$", "", name, flags=re.I)
    name = re.sub(r"\s*операц.*$", "", name, flags=re.I)
    name = name.strip(" .,\u00a0")
    name = re.sub(r"\s+\.", ".", name)
    return name if name else None


def _infer_direction(sign: str, category: str, body_text: str) -> str:
    if sign == "+":
        return "income"
    if sign in ("-", "\u2212", "\u2013"):
        return "expense"
    cat = (category or "").lower()
    body = (body_text or "").lower()
    if "перевод на карту" in cat or "перевод от" in body:
        return "income"
    if any(k in cat for k in [
        "выдача наличных", "ресторан", "рестораны и кафе",
        "автомобиль", "прочие операции", "перевод с карты",
    ]):
        return "expense"
    return "expense"


def _parse_text_based(pdf_bytes: bytes) -> list[dict[str, Any]]:
    """Parse Sber personal statement using text extraction + regex."""
    lines: list[str] = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            txt = page.extract_text() or ""
            for line in txt.splitlines():
                line = _norm(line)
                if line:
                    lines.append(line)

    # Group lines into blocks: each block starts with a date header line
    blocks: list[list[str]] = []
    cur: list[str] = []
    for ln in lines:
        if _DATE_HEAD_RE.match(ln):
            if cur:
                blocks.append(cur)
            cur = [ln]
        else:
            if cur:
                cur.append(ln)
    if cur:
        blocks.append(cur)

    transactions: list[dict[str, Any]] = []
    for blk in blocks:
        head = _fix_decimals(blk[0])
        m = _HEADER_PARSE_RE.match(head)
        if not m:
            continue

        date_str = m.group("date")
        time_str = m.group("time")
        category = _norm(m.group("category"))
        sign = (m.group("sign") or "").replace("\u2212", "-").replace("\u2013", "-")
        amount_s = m.group("amount")
        balance_s = m.group("balance")

        # Body lines (purpose / description)
        body_lines = [s for s in blk[1:] if not _BALANCE_LABELS_RE.search(s)]
        body_text = _norm(" ".join(body_lines))

        value = _to_float(amount_s)
        if not value:
            continue
        balance_val = _to_float(balance_s)

        direction = _infer_direction(sign, category, body_text)
        purpose = _clean_purpose(body_text if body_text else category)
        counterparty = _counterparty_sber(purpose or category)

        dt = parse_date(date_str)
        if not dt:
            continue

        transactions.append({
            "date": dt.isoformat(),
            "time": time_str,
            "amount": str(value),
            "direction": direction,
            "counterparty": counterparty,
            "purpose": purpose if purpose else category,
            "balance": str(balance_val) if balance_val is not None else None,
        })

    return transactions


# ========== Table-based parser helpers (business statements) ==========

def _extract_account_number(text: str) -> str | None:
    """Extract Sber account number (20 digits starting with 408...) from page text."""
    # Look for 20-digit account number (standard Russian bank account format)
    match = re.search(r'\b(40\d{18})\b', text)
    if match:
        return match.group(1)
    # Handle spaced format from personal statements: "40817 810 6 3812 1486773"
    match = re.search(r'(40\d{3}[\s\xa0]+\d{3}[\s\xa0]+\d[\s\xa0]+\d{4}[\s\xa0]+\d{7})', text)
    if match:
        digits = re.sub(r'[\s\xa0]', '', match.group(1))
        if len(digits) == 20:
            return digits
    # Also try "Номер счёта" / "р/с" / "Счёт" patterns
    match = re.search(r'(?:(?:номер\s*)?сч[её]т[а]?\s*[:\s№]*|р/?с\s*[:\s№]*)(\d{20})', text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def _normalize_header(row: list[str | None]) -> dict[str, int] | None:
    """Map column names to indices. Returns None if not a transaction header."""
    if not row:
        return None

    mapping: dict[str, int] = {}
    for i, cell in enumerate(row):
        if not cell:
            continue
        cell_lower = cell.strip().lower().replace('\n', ' ')

        if any(k in cell_lower for k in ['дата операц', 'дата опер']):
            if 'date' not in mapping:
                mapping['date'] = i
        elif 'списан' in cell_lower or 'дата списан' in cell_lower:
            mapping['date_posted'] = i
        elif any(k in cell_lower for k in ['контрагент', 'получатель', 'плательщик', 'корреспондент']):
            mapping['counterparty'] = i
        elif any(k in cell_lower for k in ['назначение', 'основание']):
            mapping['purpose'] = i
        elif any(k in cell_lower for k in ['дебет', 'расход', 'списание']):
            mapping['debit'] = i
        elif any(k in cell_lower for k in ['кредит', 'приход', 'зачисление']):
            mapping['credit'] = i
        elif 'остаток' in cell_lower or 'баланс' in cell_lower:
            mapping['balance'] = i
        elif 'сумма' in cell_lower:
            mapping['amount'] = i
        elif 'категория' in cell_lower:
            if 'purpose' not in mapping:
                mapping['purpose'] = i
        elif 'операция' in cell_lower or 'описание' in cell_lower:
            if 'purpose' not in mapping:
                mapping['purpose'] = i
        elif 'инн' in cell_lower:
            mapping['inn'] = i
        elif 'дата' in cell_lower:
            if 'date' not in mapping:
                mapping['date'] = i

    # Must have at least date and some amount column
    if 'date' not in mapping:
        return None
    if 'debit' not in mapping and 'credit' not in mapping and 'amount' not in mapping:
        return None

    return mapping


def _parse_row(header: dict[str, int], row: list[str | None]) -> dict[str, Any] | None:
    """Parse a single table row into a transaction dict."""
    date_raw = row[header['date']] if 'date' in header else None
    dt = parse_date(date_raw)
    if not dt:
        return None

    # Determine amount and direction
    direction = "unknown"
    amount = None

    if 'debit' in header and 'credit' in header:
        debit = normalize_amount(row[header['debit']])
        credit = normalize_amount(row[header['credit']])
        if debit and debit > 0:
            amount = debit
            direction = "expense"
        elif credit and credit > 0:
            amount = credit
            direction = "income"
        else:
            return None
    elif 'amount' in header:
        raw_str = (row[header['amount']] or '').strip()
        raw_amount = normalize_amount(raw_str)
        if not raw_amount:
            return None
        if raw_amount < 0:
            amount = abs(raw_amount)
            direction = "expense"
        elif raw_str.startswith('+'):
            amount = raw_amount
            direction = "income"
        else:
            # Unsigned positive = expense (Sber personal statement convention)
            amount = raw_amount
            direction = "expense"
    else:
        return None

    counterparty = clean_text(row[header['counterparty']]) if 'counterparty' in header else None
    purpose = clean_text(row[header['purpose']]) if 'purpose' in header else None
    balance = normalize_amount(row[header.get('balance', -1)]) if 'balance' in header else None

    time_str = parse_time(date_raw)

    return {
        "date": dt.isoformat(),
        "time": time_str,
        "amount": str(amount),
        "direction": direction,
        "counterparty": counterparty,
        "purpose": purpose,
        "balance": str(balance) if balance is not None else None,
    }
