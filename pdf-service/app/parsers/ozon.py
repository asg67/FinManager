"""Ozon Bank statement PDF parser.

Handles Ozon Bank (ОЗОН Банк) account statements.
Table-based extraction with two strategies (lines → text fallback).
Columns: Дата операции, (unused), Назначение, Сумма.
Amount format: "+1 234,56" / "-1 234,56".
"""

import re
import pdfplumber
from io import BytesIO
from typing import Any, Optional

from .utils import parse_date, clean_text

NBSP = "\u00a0"


def parse_ozon(pdf_bytes: bytes) -> dict[str, Any]:
    """Parse an Ozon Bank PDF statement and return transactions + account identifier."""
    account_id = None
    transactions: list[dict[str, Any]] = []

    _amt_re = re.compile(r"([+-])\s*([\d\s]+(?:[.,]\d{2})?)")
    _cp_re = re.compile(r"Получатель:\s*([^\.]+)")
    _org_re = re.compile(r'(ООО|АО|ИП|ПАО)\s*"?«?([^"»]+?)»?"?')

    def _split_dt(dt_cell: str) -> tuple[str, Optional[str]]:
        s = (dt_cell or "").replace("\n", " ").replace(NBSP, " ").strip()
        m = re.search(r"(\d{2}\.\d{2}\.\d{4}).*?(\d{2}:\d{2}(?::\d{2})?)", s)
        if m:
            return m.group(1), m.group(2)
        d = re.search(r"\d{2}\.\d{2}\.\d{4}", s)
        return (d.group(0) if d else ""), None

    def _parse_amount(a: str) -> tuple[Optional[str], Optional[float]]:
        txt = (a or "").replace(NBSP, " ")
        m = _amt_re.search(txt)
        if not m:
            return None, None
        sign = m.group(1)
        val = float(m.group(2).replace(" ", "").replace(",", "."))
        return sign, val

    def _counterparty(purpose: str) -> Optional[str]:
        m = _cp_re.search(purpose or "")
        if m:
            return m.group(1).strip().strip('"""„').strip() or None
        m2 = _org_re.search(purpose or "")
        if m2:
            return (m2.group(1) + " " + m2.group(2)).strip() or None
        return None

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        # Extract account number from text
        for page in pdf.pages[:3]:
            text = page.extract_text() or ""
            if not account_id:
                account_id = _extract_account_number(text)

        # Parse transactions from tables
        for page in pdf.pages:
            tables = page.extract_tables(
                table_settings={"vertical_strategy": "lines", "horizontal_strategy": "lines"}
            )
            if not tables:
                tables = page.extract_tables(
                    table_settings={"vertical_strategy": "text", "horizontal_strategy": "text"}
                )
            if not tables:
                continue

            for tbl in tables:
                if not tbl or not tbl[0]:
                    continue
                header = [(h or "").replace(NBSP, " ") for h in tbl[0]]
                # Ozon tables start with "Дата операции"
                if "Дата операции" not in (header[0] if header else ""):
                    continue

                # Skip subheader row (index 1), data starts at index 2
                for r in tbl[2:]:
                    if not r or not r[0]:
                        continue
                    dt_cell = (r[0] or "").strip()
                    purpose = (r[2] or "").replace("\n", " ").replace(NBSP, " ").strip() if len(r) > 2 else ""
                    amt_cell = (r[3] or "").strip() if len(r) > 3 else ""
                    if not dt_cell or not amt_cell:
                        continue

                    date_ru, time_str = _split_dt(dt_cell)
                    sign, amount = _parse_amount(amt_cell)
                    if not date_ru or not sign:
                        continue

                    dt = parse_date(date_ru)
                    if not dt:
                        continue

                    transactions.append({
                        "date": dt.isoformat(),
                        "time": time_str,
                        "amount": str(amount),
                        "direction": "income" if sign == "+" else "expense",
                        "counterparty": _counterparty(purpose),
                        "purpose": clean_text(purpose),
                        "balance": None,
                    })

    return {
        "transactions": transactions,
        "account_identifier": account_id,
    }


def _extract_account_number(text: str) -> Optional[str]:
    """Extract Ozon Bank account number from page text."""
    # Standard 20-digit account number
    match = re.search(r'\b(40\d{18})\b', text)
    if match:
        return match.group(1)
    # "Номер счёта" pattern with possible spaces
    match = re.search(
        r'(?:Номер\s+сч[её]та)\s*[:№]?\s*([0-9\s\u00A0\u2007\u2009\u202F\-]{10,})',
        text, re.I,
    )
    if match:
        digits = re.sub(r'\D', '', match.group(1))
        if len(digits) == 20:
            return digits
    return None
