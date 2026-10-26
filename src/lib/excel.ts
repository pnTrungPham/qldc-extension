import type { WorkBook } from 'xlsx';

// xlsx is large and only the Import/Export pages need it, so it loads on first use.
const load = () => import('xlsx');

/** First sheet of an .xlsx/.xls/.csv file as rows of text (dates formatted dd/mm/yyyy), plus how many sheets the file has. */
export async function readTable(file: File): Promise<{ rows: string[][]; sheets: number }> {
  const XLSX = await load();
  const book: WorkBook = /\.csv$/i.test(file.name)
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });

  const sheets = book.SheetNames.length;
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) return { rows: [], sheets };
  const rows = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', dateNF: 'dd/mm/yyyy' })
    .map((row) => row.map((cell) => String(cell ?? '').trim()));
  return { rows, sheets };
}

/** Saves rows as a one-sheet .xlsx download. `title` becomes a bold-less first line above the header row. */
export async function downloadXlsx(filename: string, rows: Array<Array<string | number>>, title?: string) {
  const XLSX = await load();
  const sheet = XLSX.utils.aoa_to_sheet(title ? [[title], [], ...rows] : rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  XLSX.writeFile(book, filename);
}
