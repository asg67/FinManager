"""Sber bank statement PDF parser.

Handles Sber business (ИП/ООО) account statements.
Typical columns: Дата, №док, Контрагент, ИНН, Назначение, Дебет, Кредит, Остаток.
Alternative: Дата операции, Дата списания, Операция, Сумма, Остаток.
"""

import pdfplumber
from io import BytesIO
from typing import Any

from .utils import normalize_amount, parse_date, parse_time, clean_text


def parse_sber(pdf_bytes: bytes) -> dict[str, Any]:
    """Parse a Sber PDF statement and return transactions + account identifier."""
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

    return {
        "transactions": transactions,
        "account_identifier": account_id,
    }


def _extract_account_number(text: str) -> str | None:
    """Extract Sber account number (20 digits starting with 408...) from page text."""
    import re
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
