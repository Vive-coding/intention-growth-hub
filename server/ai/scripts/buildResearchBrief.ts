import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Some environments mis-resolve the default entry; import the direct module path
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { ChatOpenAI } from '@langchain/openai';

// __dirname is not defined in ESM; reconstruct it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const inputPath = process.argv.slice(2).join(' ').trim();
  if (!inputPath) {
    console.error('Usage: tsx server/ai/scripts/buildResearchBrief.ts "<pdf file path>"');
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  // Read PDF -> text
  const dataBuffer = fs.readFileSync(abs);
  const parsed = await pdf(dataBuffer);
  const rawText = (parsed.text || '').replace(/\s+$/g, '').trim();
  if (!rawText) {
    console.error('No text extracted from PDF');
    process.exit(1);
  }

  // Summarize to a concise research brief
  const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0.2 });
  const prompt = `Condense the following material into a 1–2 page brief for an evidence-based life coaching agent.
Focus on:
- Principles and frameworks (SMART, WOOP, implementation intentions, CBT links)
- Patterns to favor and anti-patterns to avoid
- Style checklist (specific, measurable, low-effort defaults, mechanism-of-action)
- Safety and ethics notes
Return clean Markdown without code fences.

SOURCE:\n${rawText.slice(0, 28000)}\n`;

  const res = await llm.invoke([{ role: 'user', content: prompt }]);
  const brief = (res?.content as string || '').trim();
  if (!brief) {
    console.error('LLM returned empty brief');
    process.exit(1);
  }

  const outDir = path.resolve(__dirname, '..', 'research');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'brief.md');
  fs.writeFileSync(outPath, brief, 'utf8');
  console.log('✅ Wrote research brief to', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


