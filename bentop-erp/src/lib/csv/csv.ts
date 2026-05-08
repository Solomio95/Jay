export type CsvRow = Record<string, string | number | boolean | null | undefined>;

export function toCsv(rows: CsvRow[], headers?: string[]) {
  const columns = headers ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [columns.join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(row[column])).join(","));
  }

  return lines.join("\r\n");
}

export function parseCsv(input: string): Record<string, string>[] {
  const records = parseCsvRecords(input);
  if (records.length === 0) return [];

  const headers = records[0].map((header) => header.trim());
  return records
    .slice(1)
    .filter((record) => record.some((value) => value.trim().length > 0))
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
    );
}

function escapeCsvValue(value: CsvRow[string]) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvRecords(input: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      record.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      continue;
    }

    field += char;
  }

  record.push(field);
  records.push(record);
  return records;
}
