import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { OpenAIEmbeddings } from "@langchain/openai";
import { saveFlatIndex } from "../vector/flatStore";
import { db } from '../../db';
import { insights, suggestedGoals, suggestedHabits } from '../../../shared/schema';
import { and, eq } from "drizzle-orm";

function toDoc(title: string, body: string): string {
  return `${title}\n\n${body}`.trim();
}

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: tsx server/ai/scripts/indexUserHistory.ts <userId>');
    process.exit(1);
  }

  const insightRows = await db.select().from(insights).where(eq(insights.userId, userId));
  const goalRows = await db
    .select({
      id: suggestedGoals.id,
      title: suggestedGoals.title,
      description: suggestedGoals.description,
      archived: suggestedGoals.archived,
      insightUserId: insights.userId,
    })
    .from(suggestedGoals)
    .innerJoin(insights, eq(suggestedGoals.insightId, insights.id))
    .where(and(eq(insights.userId, userId), eq(suggestedGoals.archived, false)));
  const habitRows = await db
    .select({
      id: suggestedHabits.id,
      title: suggestedHabits.title,
      description: suggestedHabits.description,
      archived: suggestedHabits.archived,
      insightUserId: insights.userId,
    })
    .from(suggestedHabits)
    .innerJoin(insights, eq(suggestedHabits.insightId, insights.id))
    .where(and(eq(insights.userId, userId), eq(suggestedHabits.archived, false)));

  const docs: string[] = [];
  for (const i of insightRows as any[]) {
    docs.push(toDoc(`INSIGHT: ${i.title}`, i.explanation || ''));
  }
  for (const g of goalRows as any[]) {
    docs.push(toDoc(`GOAL: ${g.title}`, g.description || ''));
  }
  for (const h of habitRows as any[]) {
    const desc = `${h.description || ''}`;
    docs.push(toDoc(`HABIT: ${h.title}`, desc));
  }

  if (docs.length === 0) {
    console.error('No user history content to index');
    process.exit(1);
  }

  const emb = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });
  const vectors = await emb.embedDocuments(docs);
  const indexDir = path.resolve(process.cwd(), 'server', 'ai', 'indexes', 'users', userId);
  saveFlatIndex(indexDir, { items: docs.map((text, i) => ({ text, embedding: vectors[i] })), model: 'text-embedding-3-small', createdAt: new Date().toISOString() });
  console.log('✅ Built user history flat index at', indexDir);
}

main().catch(e => { console.error(e); process.exit(1); });


