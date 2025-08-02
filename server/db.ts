// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

console.log("Current DATABASE_URL:", process.env.DATABASE_URL);
console.log("All env variables:", process.env);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the connection
const client = postgres(process.env.DATABASE_URL);

// Create the database instance with schema
export const db = drizzle(client, { schema });