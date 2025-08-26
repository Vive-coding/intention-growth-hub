import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Loads the distilled research brief used to condition the agent.
 * Returns an empty string if the brief is missing; callers should handle
 * the empty case gracefully.
 */
// __dirname shim for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadResearchBrief(): string {
  try {
    const briefPath = path.resolve(__dirname, 'research', 'brief.md');
    if (fs.existsSync(briefPath)) {
      const raw = fs.readFileSync(briefPath, 'utf8');
      return raw.trim();
    }
  } catch (err) {
    console.warn('[research] Could not load research brief:', err);
  }
  return '';
}

/**
 * Returns a truncated version of the research brief to keep token usage bounded.
 * The truncation strategy keeps the beginning, and if the document is large,
 * appends the last 500 characters to retain any concluding guidance.
 */
export function loadResearchBriefCapped(maxChars: number = 6000): string {
  const brief = loadResearchBrief();
  if (!brief) return '';
  if (brief.length <= maxChars) return brief;
  const head = brief.slice(0, Math.max(0, maxChars - 520));
  const tail = brief.slice(-500);
  return `${head}\n\n…\n\n${tail}`;
}


