import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('vocab.db');

db.execSync(
  'CREATE TABLE IF NOT EXISTS words (id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT NOT NULL, meaning TEXT NOT NULL);'
);

export type Word = {
  id: number;
  word: string;
  meaning: string;
};

export function getWordCount(): number {
  return db.getFirstSync<{ total: number }>('SELECT COUNT(*) as total FROM words;')?.total ?? 0;
}

export function getAllWords(): Word[] {
  return db.getAllSync<Word>('SELECT * FROM words ORDER BY word ASC;');
}

export function insertWord(word: string, meaning: string): void {
  db.runSync('INSERT INTO words (word, meaning) VALUES (?, ?);', [word, meaning]);
}

export function updateWord(id: number, word: string, meaning: string): void {
  db.runSync('UPDATE words SET word = ?, meaning = ? WHERE id = ?;', [word, meaning, id]);
}

export function deleteWord(id: number): void {
  db.runSync('DELETE FROM words WHERE id = ?;', [id]);
}
