/**
 * CSV parsing utilities
 */

/**
 * Parses a CSV line, handling quoted fields correctly
 * @param line - The CSV line to parse
 * @returns Array of field values
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parses a CSV file content into lines
 * @param content - The CSV file content
 * @returns Array of CSV lines
 */
export function parseCSVFile(content: string): string[] {
  return content.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Detects CSV format and returns column mapping
 * @param lines - Array of CSV lines
 * @param expectedColumns - Array of expected column names (lowercase)
 * @returns Object with startIndex and columnMap
 */
export function detectCSVFormat(
  lines: string[],
  expectedColumns: string[]
): { startIndex: number; columnMap: Record<string, number> } {
  let startIndex = 0;
  const columnMap: Record<string, number> = {};

  if (lines.length === 0) {
    return { startIndex, columnMap };
  }

  const headerRow = lines[0].toLowerCase();

  // Check if header exists
  if (expectedColumns.some(col => headerRow.includes(col))) {
    startIndex = 1;
    const headers = parseCSVLine(headerRow).map(h => h.trim().toLowerCase());
    
    expectedColumns.forEach(col => {
      const index = headers.findIndex(h => h === col);
      if (index !== -1) {
        columnMap[col] = index;
      }
    });
  }

  return { startIndex, columnMap };
}

/**
 * Escapes a CSV field value
 * @param field - The field value to escape
 * @returns Escaped field value
 */
export function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '';
  let str = String(field);
  // A cell that starts with = + - @ or a tab is a formula to Excel and
  // LibreOffice, and a spool named `=HYPERLINK(...)` would run when the export
  // is opened. A leading apostrophe makes it text. Plain numbers keep their
  // minus sign, since they are the one thing a spreadsheet should still treat
  // as a number.
  if (/^[=+\-@\t\r]/.test(str) && !/^-?\d+(\.\d+)?$/.test(str)) {
    str = `'${str}`;
  }
  return /[",\n\r]/.test(str)
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

