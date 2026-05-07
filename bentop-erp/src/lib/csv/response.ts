import { toCsv, type CsvRow } from "./csv";

export function csvResponse(filename: string, rows: CsvRow[], headers?: string[]) {
  return new Response(toCsv(rows, headers), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
