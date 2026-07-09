import { parseCSV, MAX_WORD_LENGTH, MAX_MEANING_LENGTH, MAX_CSV_ROWS } from '../../utils/csv';

function makeCSV(headers: string, rows: string[]): string {
  return [headers, ...rows].join('\n');
}

describe('parseCSV', () => {
  describe('valid input', () => {
    it('parses comma-separated CSV', () => {
      const csv = makeCSV('word,meaning', ['hello,hola', 'cat,gato']);
      const { rows, skippedLength } = parseCSV(csv);
      expect(rows).toEqual([{ word: 'hello', meaning: 'hola' }, { word: 'cat', meaning: 'gato' }]);
      expect(skippedLength).toBe(0);
    });

    it('parses semicolon-separated CSV', () => {
      const csv = makeCSV('word;meaning', ['hello;hola', 'cat;gato']);
      const { rows } = parseCSV(csv);
      expect(rows).toEqual([{ word: 'hello', meaning: 'hola' }, { word: 'cat', meaning: 'gato' }]);
    });

    it('trims whitespace from values', () => {
      const csv = makeCSV('word,meaning', ['  hello  ,  hola  ']);
      const { rows } = parseCSV(csv);
      expect(rows[0]).toEqual({ word: 'hello', meaning: 'hola' });
    });

    it('handles quoted fields with commas inside', () => {
      const csv = makeCSV('word,meaning', ['"to go, to walk",ir']);
      const { rows } = parseCSV(csv);
      expect(rows[0].word).toBe('to go, to walk');
      expect(rows[0].meaning).toBe('ir');
    });

    it('handles headers in any order', () => {
      const csv = makeCSV('meaning,word', ['hola,hello']);
      const { rows } = parseCSV(csv);
      expect(rows[0]).toEqual({ word: 'hello', meaning: 'hola' });
    });

    it('header matching is case-insensitive', () => {
      const csv = makeCSV('Word,Meaning', ['hello,hola']);
      const { rows } = parseCSV(csv);
      expect(rows[0]).toEqual({ word: 'hello', meaning: 'hola' });
    });

    it('ignores rows with empty word or meaning', () => {
      const csv = makeCSV('word,meaning', ['hello,hola', ',hola', 'cat,', '']);
      const { rows } = parseCSV(csv);
      expect(rows).toHaveLength(1);
    });

    it('handles CRLF line endings', () => {
      const csv = 'word,meaning\r\nhello,hola\r\ncat,gato';
      const { rows } = parseCSV(csv);
      expect(rows).toHaveLength(2);
    });
  });

  describe('error cases', () => {
    it('throws "empty" when file has only a header', () => {
      expect(() => parseCSV('word,meaning')).toThrow('empty');
    });

    it('throws "empty" when file is blank', () => {
      expect(() => parseCSV('')).toThrow('empty');
    });

    it('throws "columns" when word column is missing', () => {
      const csv = makeCSV('term,meaning', ['hello,hola']);
      expect(() => parseCSV(csv)).toThrow('columns');
    });

    it('throws "columns" when meaning column is missing', () => {
      const csv = makeCSV('word,definition', ['hello,hola']);
      expect(() => parseCSV(csv)).toThrow('columns');
    });
  });

  describe('length validation', () => {
    it('skips rows where word exceeds MAX_WORD_LENGTH', () => {
      const longWord = 'a'.repeat(MAX_WORD_LENGTH + 1);
      const csv = makeCSV('word,meaning', [`${longWord},hola`, 'cat,gato']);
      const { rows, skippedLength } = parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].word).toBe('cat');
      expect(skippedLength).toBe(1);
    });

    it('skips rows where meaning exceeds MAX_MEANING_LENGTH', () => {
      const longMeaning = 'b'.repeat(MAX_MEANING_LENGTH + 1);
      const csv = makeCSV('word,meaning', [`hello,${longMeaning}`, 'cat,gato']);
      const { rows, skippedLength } = parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(skippedLength).toBe(1);
    });

    it('accepts rows at exactly the length limit', () => {
      const exactWord = 'a'.repeat(MAX_WORD_LENGTH);
      const exactMeaning = 'b'.repeat(MAX_MEANING_LENGTH);
      const csv = makeCSV('word,meaning', [`${exactWord},${exactMeaning}`]);
      const { rows, skippedLength } = parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(skippedLength).toBe(0);
    });

    it('counts all length-invalid rows in skippedLength', () => {
      const longWord = 'a'.repeat(MAX_WORD_LENGTH + 1);
      const csv = makeCSV('word,meaning', [
        `${longWord},hola`,
        `${longWord},hola`,
        'cat,gato',
      ]);
      const { skippedLength } = parseCSV(csv);
      expect(skippedLength).toBe(2);
    });
  });

  describe('row limit', () => {
    it(`caps import at ${MAX_CSV_ROWS} rows`, () => {
      const rows = Array.from({ length: MAX_CSV_ROWS + 10 }, (_, i) => `word${i},meaning${i}`);
      const csv = makeCSV('word,meaning', rows);
      const { rows: parsed } = parseCSV(csv);
      expect(parsed.length).toBeLessThanOrEqual(MAX_CSV_ROWS);
    });
  });
});
