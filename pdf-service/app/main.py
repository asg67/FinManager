"""PDF parsing microservice — stub for development."""

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse

app = FastAPI(title="FinManager PDF Service", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pdf-parser"}


@app.post("/parse")
async def parse_pdf(
    file: UploadFile = File(...),
    bank_code: str = Form(...),
):
    """Parse a bank PDF statement. Stub — returns empty list."""
    return JSONResponse(
        content={
            "bank_code": bank_code,
            "file_name": file.filename,
            "transactions": [],
            "message": "Stub: parser not implemented yet",
        }
    )
