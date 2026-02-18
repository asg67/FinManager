"""PDF parsing microservice for FinManager."""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from .parsers import PARSERS

app = FastAPI(title="FinManager PDF Service", version="1.0.0")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "pdf-parser",
        "supported_banks": list(PARSERS.keys()),
    }


@app.post("/parse")
async def parse_pdf(
    file: UploadFile = File(...),
    bank_code: str = Form(...),
):
    """Parse a bank PDF statement and return extracted transactions."""
    if bank_code not in PARSERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported bank_code: '{bank_code}'. Supported: {list(PARSERS.keys())}",
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if len(pdf_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    parser = PARSERS[bank_code]

    try:
        result = parser(pdf_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse PDF: {str(e)}",
        )

    # Parsers return dict with "transactions" and "account_identifier"
    if isinstance(result, dict):
        transactions = result.get("transactions", [])
        account_identifier = result.get("account_identifier")
    else:
        # Backward compatibility
        transactions = result
        account_identifier = None

    return JSONResponse(
        content={
            "bank_code": bank_code,
            "file_name": file.filename,
            "transactions": transactions,
            "count": len(transactions),
            "account_identifier": account_identifier,
        }
    )
