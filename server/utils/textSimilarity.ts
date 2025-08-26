import { embedTexts } from "../ai/utils/embeddings";

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","if","then","for","of","to","in","on","with","by","at","from","into","about","as","is","are","was","were","be","been","being","that","this","it","its","your","you","i","we","our","us"
]);

export function normalizeText(input: string): string {
  if (!input) return "";
  const lowered = input.toLowerCase();
  const noPunct = lowered.replace(/[^a-z0-9\s]/g, " ");
  const tokens = noPunct.split(/\s+/).filter(Boolean);
  const filtered = tokens.filter(t => !STOP_WORDS.has(t));
  const joined = filtered.join(" ").trim();
  // Simple concept hash: first 64 chars of normalized text hashed via djb2
  return joined;
}

export function conceptHash(text: string): string {
  const s = normalizeText(text);
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
  }
  // convert to unsigned and hex
  const hex = (hash >>> 0).toString(16);
  return hex.padStart(8, '0');
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

export async function embedNormalized(texts: string[]): Promise<number[][]> {
  const normalized = texts.map(normalizeText);
  return embedTexts(normalized);
}

export interface SimilarityDecision {
  similarity: number;
  relation: "duplicate" | "similar" | "distinct";
}

export function decideSimilarity(sim: number): SimilarityDecision {
  // Duplicate at >= 0.85 (inclusive)
  if (sim >= 0.85) return { similarity: sim, relation: "duplicate" };
  // Reinforcement range: [0.75, 0.85)
  if (sim >= 0.75) return { similarity: sim, relation: "similar" };
  return { similarity: sim, relation: "distinct" };
}


