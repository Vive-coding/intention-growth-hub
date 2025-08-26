import fs from 'fs';
import path from 'path';

export interface FlatItem {
  text: string;
  embedding: number[];
}

export interface FlatIndex {
  items: FlatItem[];
  model: string;
  createdAt: string;
}

export function saveFlatIndex(dir: string, index: FlatIndex) {
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'flat.index.json');
  fs.writeFileSync(outPath, JSON.stringify(index), 'utf8');
}

export function loadFlatIndex(dir: string): FlatIndex | null {
  const p = path.join(dir, 'flat.index.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as FlatIndex;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function topKByCosine(query: number[], items: FlatItem[], k: number): Array<{ text: string; score: number }>{
  const scored = items.map(it => ({ text: it.text, score: cosineSimilarity(query, it.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}


