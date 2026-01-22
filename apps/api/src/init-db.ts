// Initialize database - create TelegramAlert table if not exists
import { prisma } from '@polymarket/database';

export async function initDatabase() {
  try {
    console.log('🔧 Checking database schema...');
    
    // Try to create TelegramAlert table using raw SQL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TelegramAlert" (
        "id" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'medium',
        "marketTitle" TEXT NOT NULL,
        "marketSlug" TEXT,
        "outcome" TEXT,
        "priceOld" DOUBLE PRECISION,
        "priceNew" DOUBLE PRECISION,
        "price" DOUBLE PRECISION,
        "percentChange" DOUBLE PRECISION,
        "durationSec" INTEGER,
        "direction" TEXT,
        "sizeUsd" DOUBLE PRECISION,
        "wallet" TEXT,
        "alertTimestamp" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TelegramAlert_pkey" PRIMARY KEY ("id")
      );
    `);
    
    console.log('✅ TelegramAlert table ready');
    
    // Create indexes if not exist
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TelegramAlert_type_alertTimestamp_idx" 
      ON "TelegramAlert"("type", "alertTimestamp");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TelegramAlert_alertTimestamp_idx" 
      ON "TelegramAlert"("alertTimestamp");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TelegramAlert_marketSlug_idx" 
      ON "TelegramAlert"("marketSlug");
    `);
    
    console.log('✅ Indexes created');
    console.log('✅ Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    // Don't throw - allow API to start even if table already exists
  }
}
