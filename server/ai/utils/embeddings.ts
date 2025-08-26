import { OpenAIEmbeddings } from "@langchain/openai";

export async function embedTexts(texts: string[], model: string = "text-embedding-3-small"): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const emb = new OpenAIEmbeddings({ model });
  return emb.embedDocuments(texts);
}

export async function embedQuery(text: string, model: string = "text-embedding-3-small"): Promise<number[]> {
  const emb = new OpenAIEmbeddings({ model });
  return emb.embedQuery(text);
}


