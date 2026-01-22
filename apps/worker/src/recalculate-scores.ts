// Recalculate rarity scores for ALL traders in database
// Use this to fix score normalization after system changes

import 'dotenv/config';
import { prisma } from '@polymarket/database';
import { logger } from './lib/logger';

// Calculate rarity score (0-1000 points) - SAME AS ingestion.worker.ts
function calculateRarityScore(
  pnl: number,
  volume: number,
  marketsTraded: number,
  rank: number,
  hasTwitter: boolean
): number {
  let score = 0;

  // PnL contribution (max 400 points)
  if (pnl > 1000000) score += 400;
  else if (pnl > 500000) score += 350;
  else if (pnl > 250000) score += 300;
  else if (pnl > 100000) score += 250;
  else if (pnl > 50000) score += 200;
  else if (pnl > 25000) score += 150;
  else if (pnl > 10000) score += 100;
  else if (pnl > 5000) score += 50;

  // Volume contribution (max 200 points)
  if (volume > 5000000) score += 200;
  else if (volume > 2000000) score += 150;
  else if (volume > 1000000) score += 100;
  else if (volume > 500000) score += 75;
  else if (volume > 250000) score += 50;
  else if (volume > 100000) score += 25;

  // Markets traded contribution (max 200 points)
  if (marketsTraded > 500) score += 200;
  else if (marketsTraded > 250) score += 150;
  else if (marketsTraded > 100) score += 100;
  else if (marketsTraded > 50) score += 75;
  else if (marketsTraded > 25) score += 50;
  else if (marketsTraded > 10) score += 25;

  // Rank bonus (max 150 points)
  if (rank <= 10) score += 150;
  else if (rank <= 25) score += 125;
  else if (rank <= 50) score += 100;
  else if (rank <= 100) score += 75;
  else if (rank <= 250) score += 50;
  else if (rank <= 500) score += 25;

  // Twitter presence (max 50 points)
  if (hasTwitter) score += 50;

  return Math.min(score, 1000); // Cap at 1000
}

async function main() {
  try {
    logger.info('🔄 Starting score recalculation for ALL traders...');

    // Get all traders
    const traders = await prisma.trader.findMany({
      select: {
        address: true,
        totalPnl: true,
        tradeCount: true,
        twitterUsername: true,
        rarityScore: true,
      },
    });

    logger.info(`📊 Found ${traders.length} traders in database`);

    // Sort by PnL to get correct ranks
    const sorted = traders.sort((a, b) => (b.totalPnl || 0) - (a.totalPnl || 0));

    let updated = 0;
    let already_ok = 0;
    let batch = [];
    let broken = 0;

    for (let i = 0; i < sorted.length; i++) {
      const trader = sorted[i];
      const rank = i + 1;
      const hasTwitter = !!trader.twitterUsername;

      const newScore = calculateRarityScore(
        Number(trader.totalPnl) || 0,
        0, // volume not in DB schema
        trader.tradeCount || 0,
        rank,
        hasTwitter
      );

      const oldScore = trader.rarityScore || 0;

      // Log first 10 broken scores
      if (oldScore > 1000 && broken < 10) {
        logger.info(`  🔍 BROKEN: ${trader.address.slice(0, 10)} | OLD=${oldScore} | NEW=${newScore}`);
        broken++;
      }

      // FORCE UPDATE ALL (don't check diff - just recalculate everything!)
      batch.push({
        where: { address: trader.address },
        data: { rarityScore: newScore },
      });
      updated++;

      // Log progress every 100
      if (updated % 100 === 0) {
        logger.info(`  Progress: ${updated}/${sorted.length} traders...`);
      }

      // Batch update every 100 traders
      if (batch.length >= 100) {
        await Promise.all(
          batch.map(update => 
            prisma.trader.update(update)
          )
        );
        logger.info(`  Updated ${updated} traders...`);
        batch = [];
      }
    }

    // Update remaining
    if (batch.length > 0) {
      await Promise.all(
        batch.map(update => 
          prisma.trader.update(update)
        )
      );
    }

    logger.info(`✅ Score recalculation complete!`);
    logger.info(`   Updated: ${updated} traders`);
    logger.info(`   Broken scores fixed: ${broken} traders had score > 1000`);
    logger.info(`   Total: ${traders.length} traders`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Score recalculation failed:', error);
    process.exit(1);
  }
}

main();
