/**
 * CSV for admin exports. Cells can hold text a creator typed (names, handles), and spreadsheets run a cell that starts
 * with = + - @ (or a tab or carriage return) as a formula, so such cells get a leading apostrophe. Every cell is quoted.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
