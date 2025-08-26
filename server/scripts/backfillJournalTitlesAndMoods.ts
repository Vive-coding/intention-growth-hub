/*
  Usage: ts-node server/scripts/backfillJournalTitlesAndMoods.ts <USER_ID>
  Backfills short titles (3-5 words) and mood on existing journals for a user when missing or generic.
*/
import 'dotenv/config';
import { db } from '../db.ts';
import { journalEntries } from '../../shared/schema.ts';
import { eq, and } from 'drizzle-orm';
import { looksGenericTitle, generateTitleLLM, classifyMoodLLM, generateTagsLLM } from '../ai/utils/journal.ts';

async function main() {
  const userId = process.argv[2];
  const force = process.argv.includes('--force');
  if (!userId) {
    console.error('Pass USER_ID: ts-node server/scripts/backfillJournalTitlesAndMoods.ts <USER_ID> [--force]');
    process.exit(1);
  }

  const rows = await db.select().from(journalEntries).where(eq(journalEntries.userId, userId));
  let updated = 0;
  for (const r of rows) {
    const needsTitle = force || looksGenericTitle(r.title);
    const needsMood = force || !r.mood || String(r.mood).trim().length === 0;
    const needsTags = force || !Array.isArray(r.tags) || r.tags.length === 0;
    if (!needsTitle && !needsMood && !needsTags) continue;
    const nextTitle = needsTitle ? await generateTitleLLM(r.content || '') : r.title;
    const nextMood = needsMood ? await classifyMoodLLM(r.content || '') : r.mood;
    const nextTags = needsTags ? await generateTagsLLM(r.content || '', 5) : r.tags;
    await db
      .update(journalEntries)
      .set({ title: nextTitle, mood: nextMood, tags: nextTags as any, updatedAt: new Date() })
      .where(and(eq(journalEntries.id, r.id), eq(journalEntries.userId, userId)));
    updated++;
    console.log('Updated journal', r.id, { title: nextTitle, mood: nextMood, tags: nextTags });
  }
  console.log('Done. Updated:', updated);
}

main().catch((e) => { console.error(e); process.exit(1); });


