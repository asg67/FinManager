import ExcelJS from "exceljs";
import type { Response } from "express";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export async function createExcelResponse(
  res: Response,
  filename: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[],
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 18,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
  };
  headerRow.alignment = { vertical: "middle" };

  // Add data rows
  for (const row of rows) {
    sheet.addRow(row);
  }

  // Auto-fit: adjust width to max content length (capped)
  for (const col of sheet.columns) {
    let maxLen = String(col.header ?? "").length;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 10), 50);
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();
}
