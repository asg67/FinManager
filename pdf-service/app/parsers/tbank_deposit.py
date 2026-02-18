"""T-Bank deposit/savings account PDF parser.

Handles T-Bank deposit (вклад/накопительный счёт) statements.
Typically simpler format: Дата, Операция, Сумма, Остаток.
"""

import pdfplumber
from io import BytesIO
from typing import Any

from .utils import normalize_amount, parse_date, parse_time, clean_text


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
