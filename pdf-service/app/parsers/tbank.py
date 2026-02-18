"""T-Bank (Tinkoff) card statement PDF parser.

Handles T-Bank card/checking account statements.
Typical columns: Дата операции, Дата платежа, Номер карты, Статус,
  Сумма операции, Валюта, Сумма платежа, Валюта, Кэшбэк, Категория, MCC, Описание.
Alternative format: Дата, Операция, Сумма, Остаток.
"""

import pdfplumber
from io import BytesIO
from typing import Any

from .utils import normalize_amount, parse_date, parse_time, clean_text


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

    return {
        "transactions": transactions,
        "account_identifier": card_code,
    }


def _extract_card_code(text: str) -> str | None:
    """Extract T-Bank card code/number from page text."""
    import re
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
