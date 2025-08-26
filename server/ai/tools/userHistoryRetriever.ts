import fs from 'fs';
import path from 'path';
import { OpenAIEmbeddings } from "@langchain/openai";
import { loadFlatIndex, topKByCosine } from "../vector/flatStore";

export interface RetrievedDoc { text: string; score: number }

export async function retrieveUserHistory(userId: string, query: string, k: number = 6): Promise<RetrievedDoc[]> {
  const indexDir = path.resolve(process.cwd(), 'server', 'ai', 'indexes', 'users', userId);
  const idx = loadFlatIndex(indexDir);
  if (!idx) return [];
  const emb = new OpenAIEmbeddings({ model: idx.model || 'text-embedding-3-small' });
  const q = await emb.embedQuery(query);
  return topKByCosine(q, idx.items, k);
}


