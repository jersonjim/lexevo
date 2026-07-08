export const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_WORD_LENGTH = 100;
export const MAX_MEANING_LENGTH = 500;
export const MAX_CSV_ROWS = 1000;

export type CsvRow = { word: string; meaning: string };

export function parseCSV(text: string): { rows: CsvRow[]; skippedLength: number } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('empty');

  const firstLine = lines[0];
  const sep = (firstLine.match(/;/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? ';' : ',';

  function splitRow(line: string): string[] {
    const cols: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === sep && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }

  const headers = splitRow(firstLine).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const wi = headers.indexOf('word');
  const mi = headers.indexOf('meaning');
  if (wi === -1 || mi === -1) throw new Error('columns');

  let skippedLength = 0;
  const rows = lines.slice(1, MAX_CSV_ROWS + 1)
    .map(line => ({ word: splitRow(line)[wi]?.trim() ?? '', meaning: splitRow(line)[mi]?.trim() ?? '' }))
    .filter(r => {
      if (!r.word || !r.meaning) return false;
      if (r.word.length > MAX_WORD_LENGTH || r.meaning.length > MAX_MEANING_LENGTH) {
        skippedLength++;
        return false;
      }
      return true;
    });

  return { rows, skippedLength };
}
