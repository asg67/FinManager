"""Shared utilities for PDF parsers."""

import re
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Optional


def normalize_amount(raw: Optional[str]) -> Optional[Decimal]:
    """Parse an amount string into a Decimal.

    Handles formats like:
      '1 234,56'  '1234.56'  '-1 234,56'  '1,234.56'
    """
    if not raw or not raw.strip():
        return None

    s = raw.strip()
    # Remove currency symbols and whitespace
    s = re.sub(r'[₽$€\s\xa0]', '', s)

    if not s or s == '-':
        return None

    # Determine if comma is decimal separator:
    # If there's a comma after a dot, or comma with exactly 2 digits after → decimal comma
    if re.search(r',\d{1,2}$', s) and '.' not in s.replace(',', '', s.count(',') - 1):
        # Replace thousand dots, then comma → dot
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s and '.' in s:
        # Mixed: assume comma is thousands, dot is decimal
        s = s.replace(',', '')
    elif ',' in s:
        s = s.replace(',', '.')

    # Remove any remaining non-numeric except dot and minus
    s = re.sub(r'[^\d.\-]', '', s)

    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def parse_date(raw: Optional[str], formats: list[str] | None = None) -> Optional[date]:
    """Parse a date string trying multiple formats.

    Handles cases where the date is followed by extra text, e.g.
    '17.01.2026 07:43 281543'.
    """
    if not raw or not raw.strip():
        return None

    s = raw.strip()

    # Extract just the date-like token from the beginning (e.g. "17.01.2026" from "17.01.2026 07:43 281543")
    date_match = re.match(r'(\d{1,4}[\.\-/]\d{1,2}[\.\-/]\d{2,4})', s)
    if date_match:
        s = date_match.group(1)

    if formats is None:
        formats = [
            "%d.%m.%Y",
            "%d.%m.%y",
            "%d/%m/%Y",
            "%Y-%m-%d",
            "%d-%m-%Y",
        ]

    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue

    return None


def parse_time(raw: Optional[str]) -> Optional[str]:
    """Extract time from a string like '14:30' or '14:30:00'."""
    if not raw:
        return None

    match = re.search(r'(\d{1,2}:\d{2}(?::\d{2})?)', raw.strip())
    if match:
        return match.group(1)
    return None


def clean_text(raw: Optional[str]) -> Optional[str]:
    """Normalize whitespace in text."""
    if not raw:
        return None
    s = re.sub(r'\s+', ' ', raw.strip())
    return s if s else None


def generate_dedupe_key(
    account_id: str,
    dt: date,
    amount: Decimal,
    direction: str,
    counterparty: Optional[str] = None,
) -> str:
    """Generate a deduplication key for a transaction."""
    parts = [account_id, dt.isoformat(), str(amount), direction]
    if counterparty:
        parts.append(counterparty[:50])
    return "|".join(parts)
