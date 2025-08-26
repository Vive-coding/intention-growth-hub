import 'dotenv/config';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { saveFlatIndex } from "../vector/flatStore";

function chunk(text: string, size = 1000, overlap = 150): string[] {
  const chunks: string[] = [];
  const step = Math.max(1, size - overlap);
  for (let i = 0; i < text.length; i += step) {
    const end = Math.min(text.length, i + size);
    const slice = text.slice(i, end).trim();
    if (slice) chunks.push(slice);
    if (end === text.length) break;
  }
  return chunks;
}

async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error('Usage: tsx server/ai/scripts/indexResearch.ts <pdf|md> [more files...]');
    process.exit(1);
  }

  const docs: string[] = [];
  for (const p of inputs) {
    const abs = path.resolve(process.cwd(), p);
    if (!fs.existsSync(abs)) continue;
    const ext = path.extname(abs).toLowerCase();
    if (ext === '.pdf') {
      const parsed = await pdf(fs.readFileSync(abs));
      docs.push((parsed.text || '').trim());
    } else if (ext === '.md' || ext === '.txt') {
      docs.push(fs.readFileSync(abs, 'utf8').trim());
    }
  }

  const chunks = docs.flatMap(d => chunk(d, 1100, 200)).filter(Boolean);
  if (chunks.length === 0) {
    console.error('No content to index');
    process.exit(1);
  }

  const emb = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });
  const vectors = await emb.embedDocuments(chunks);
  const indexDir = path.resolve(process.cwd(), 'server', 'ai', 'indexes', 'research');
  saveFlatIndex(indexDir, { items: chunks.map((text, i) => ({ text, embedding: vectors[i] })), model: 'text-embedding-3-small', createdAt: new Date().toISOString() });
  console.log('✅ Built research flat index at', indexDir);
}

main().catch(e => { console.error(e); process.exit(1); });


