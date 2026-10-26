import { emptyRow, type PendingRow, type RawTable, type Target } from './targets';

/** Lowercase and accent-free, so "Họ và tên" and "ho va ten" compare equal. */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

// Exact entries are short abbreviations that would otherwise match inside other words.
const GUESSES: Array<{ target: Target; exact: string[]; includes: string[] }> = [
  { target: 'full_name', exact: ['ten', 'name', 'ho ten'], includes: ['ho va ten', 'ho ten', 'full name', 'fullname'] },
  { target: 'birth_year', exact: ['ns', 'dob'], includes: ['nam sinh', 'ngay sinh', 'year of birth', 'birth'] },
  { target: 'gender', exact: ['gt', 'sex'], includes: ['gioi tinh', 'gender'] },
  { target: 'phone', exact: ['dt', 'sdt', 'tel'], includes: ['dien thoai', 'phone'] },
  { target: 'id_last4', exact: ['id'], includes: ['cccd', 'cmnd', 'can cuoc', 'id number'] },
  { target: 'household_code', exact: [], includes: ['ma ho', 'ho so', 'household'] },
  { target: 'relation', exact: [], includes: ['quan he', 'relationship', 'vai tro'] },
  { target: 'address', exact: [], includes: ['dia chi', 'address', 'so nha'] },
  { target: 'note', exact: [], includes: ['ghi chu', 'note'] },
];

export function guessTarget(header: string): Target | '' {
  const key = fold(header);
  if (!key) return '';
  const hit = GUESSES.find((g) => g.exact.includes(key) || g.includes.some((word) => key.includes(word)));
  return hit?.target ?? '';
}

/** Index of the header row: the one among the first 10 whose cells match the most known names. */
export function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = 0;
  rows.slice(0, 10).forEach((row, index) => {
    const score = row.filter((cell) => guessTarget(cell)).length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

let tableCounter = 0;

/** Rows of text → a mappable table (header row detected, blank rows dropped). Null when there is no data. */
export function toTable(label: string, source: 'file' | 'paste', rows: string[][]): RawTable | null {
  const headerIndex = findHeaderRow(rows);
  const headers = rows[headerIndex] ?? [];
  const body = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell !== ''));
  if (!body.length) return null;

  return {
    id: `t${++tableCounter}`,
    label,
    source,
    headers,
    rows: body,
    mapping: headers.map(guessTarget),
  };
}

/** True when pasted text came from a spreadsheet (tab-separated). */
export const isTabular = (text: string) => text.split('\n').some((line) => line.includes('\t'));

export const parseTsv = (text: string): string[][] =>
  text
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim() !== '')
    .map((line) => line.split('\t').map((cell) => cell.trim()));

const LINE = /^(?:(?<role>[^:]+):\s*)?(?<name>.+?)\s+(?<year>\d{4})(?:\s+(?:sdt|đt|dt)\s*:?\s*(?<phone>[\d .+-]+))?$/i;
const ADDRESS = /^địa chỉ\s*:?\s*(?<address>.*)$/i;

function relationOf(role: string): string {
  const key = fold(role);
  if (key.startsWith('chu ho')) return 'head';
  if (/^(vo|chong)/.test(key)) return 'spouse';
  if (/^con\b/.test(key)) return 'child';
  return 'other';
}

const isFemaleRole = (role: string) => /^(vo|me|chi|ba)\b/.test(fold(role));

/**
 * Chat-style text → rows. Blocks are separated by a blank line; each block is one household.
 * Line shape: `[Role:] Full name YYYY [sdt 0xxxxxxxxx]`; a line starting "Địa chỉ" sets the household address.
 */
export function parseChat(text: string): PendingRow[] {
  const rows: PendingRow[] = [];

  text.split(/\n\s*\n/).forEach((block, blockIndex) => {
    let address = '';
    const members: PendingRow[] = [];

    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (!line) continue;

      const addressMatch = ADDRESS.exec(line);
      if (addressMatch) {
        address = addressMatch.groups!.address.trim();
        continue;
      }

      const match = LINE.exec(line);
      if (!match) continue;
      const { role = '', name, year, phone = '' } = match.groups!;
      const row = emptyRow('paste', `chat:${blockIndex}`);
      row.full_name = name.trim();
      row.birth_year = year;
      row.phone = phone.trim();
      row.relation = role ? relationOf(role) : '';
      row.gender = role && isFemaleRole(role) ? 'female' : '';
      members.push(row);
    }

    rows.push(...members.map((row) => ({ ...row, address })));
  });

  return rows;
}

export const SAMPLE_CHAT = `Địa chỉ: 12 Đường Trần Hưng
Chủ hộ: Nguyễn Văn An 1978 sdt 0903412885
Vợ: Trần Thị Bình 1980
Con: Nguyễn Văn Cường 2005 sdt 0988111222

Địa chỉ: 45 Lê Lợi
Chủ hộ: Phạm Quốc Dũng 1960 sdt 0912000111`;
