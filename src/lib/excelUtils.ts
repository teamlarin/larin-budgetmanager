import ExcelJS from 'exceljs';

/**
 * Read an Excel file and return rows as arrays (similar to xlsx sheet_to_json with header:1)
 */
export async function readExcelAsArrays(file: File): Promise<any[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  
  const rows: any[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(row.values as any[]);
  });
  
  // ExcelJS row.values is 1-indexed (index 0 is undefined), shift to 0-indexed
  return rows.map(row => row.slice(1));
}

/**
 * Read an Excel file and return rows as objects using the first row as headers
 */
export async function readExcelAsObjects(file: File): Promise<Record<string, any>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  
  const rows: Record<string, any>[] = [];
  const headers: string[] = [];
  
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = (row.values as any[]).slice(1); // 1-indexed to 0-indexed
    if (rowNumber === 1) {
      values.forEach((v) => headers.push(String(v || '')));
    } else {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ?? '';
      });
      rows.push(obj);
    }
  });
  
  return rows;
}

/**
 * Export data (array of objects) to an xlsx file and trigger download
 */
export async function exportToXlsx(
  sheets: { name: string; data: Record<string, any>[] }[],
  fileName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    if (sheet.data.length === 0) continue;
    
    const headers = Object.keys(sheet.data[0]);
    ws.addRow(headers);
    
    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    
    for (const row of sheet.data) {
      ws.addRow(headers.map(h => row[h]));
    }
    
    // Auto-fit columns
    ws.columns.forEach((col) => {
      let maxLen = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value || '').length;
        if (len > maxLen) maxLen = Math.min(len, 50);
      });
      col.width = maxLen + 2;
    });
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/**
 * Export data to CSV and trigger download
 */
export function exportToCsv(data: Record<string, any>[], fileName: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = String(row[h] ?? '');
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(','))
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBuffer(buffer: ArrayBuffer | ExcelJS.Buffer, fileName: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
