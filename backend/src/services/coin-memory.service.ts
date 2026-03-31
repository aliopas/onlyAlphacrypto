import { db } from '../config/db';
import { coinMemory } from '../models/market.model';
import { desc, eq } from 'drizzle-orm';

interface SaveMemoryParams {
  coinSymbol: string;
  eventType: string;
  eventSummary: string;
  priceAtEvent?: number;
  verdict?: string;
  confidenceScore?: number;
  riskVerdict?: string;
  keyDrivers?: string[];
  redFlags?: string[];
  sourceNewsHashes?: string[];
}

export async function saveMemory(params: SaveMemoryParams) {
  return await db.insert(coinMemory).values(params).returning();
}

export async function getRecentMemory(coinSymbol: string, limit: number = 5) {
  return await db.select().from(coinMemory).where(eq(coinMemory.coinSymbol, coinSymbol)).orderBy(desc(coinMemory.createdAt)).limit(limit);
}