import { JobData } from '../lib/queue';
import { logger } from '../lib/logger';

export async function handleScoringJob(data: JobData) {
  switch (data.type) {
    case 'calculate-rarity-scores':
      await calculateRarityScores(data.payload);
      break;
    case 'recalculate-all-scores':
      await recalculateAllScores();
      break;
    default:
      logger.warn({ type: data.type }, 'Unknown scoring job type');
  }
}

async function calculateRarityScores(payload: any) {
  logger.info('Calculating rarity scores...');
  // TODO: Implement scoring algorithm
  logger.info('Rarity scores calculation completed (stub)');
}

async function recalculateAllScores() {
  logger.info('🔧 Recalculating ALL trader scores...');
  
  // Import and run the recalculation logic inline
  const { prisma } = await import('@polymarket/database');
  
  // Calculate rarity score (0-1000) - SAME AS ingestion.worker.ts
  function calculateRarityScore(
    pnl: number,
    volume: number,
    marketsTraded: number,
    rank: number,
    hasTwitter: boolean
  ): number {
    let score = 0;
    if (pnl > 1000000) score += 400;
    else if (pnl > 500000) score += 350;
    else if (pnl > 250000) score += 300;
    else if (pnl > 100000) score += 250;
    else if (pnl > 50000) score += 200;
    else if (pnl > 25000) score += 150;
    else if (pnl > 10000) score += 100;
    else if (pnl > 5000) score += 50;
    if (volume > 5000000) score += 200;
    else if (volume > 2000000) score += 150;
    else if (volume > 1000000) score += 100;
    else if (volume > 500000) score += 75;
    else if (volume > 250000) score += 50;
    else if (volume > 100000) score += 25;
    if (marketsTraded > 500) score += 200;
    else if (marketsTraded > 250) score += 150;
    else if (marketsTraded > 100) score += 100;
    else if (marketsTraded > 50) score += 75;
    else if (marketsTraded > 25) score += 50;
    else if (marketsTraded > 10) score += 25;
    if (rank <= 10) score += 150;
    else if (rank <= 25) score += 125;
    else if (rank <= 50) score += 100;
    else if (rank <= 100) score += 75;
    else if (rank <= 250) score += 50;
    else if (rank <= 500) score += 25;
    if (hasTwitter) score += 50;
    return Math.min(score, 1000);
  }
  
  const traders = await prisma.trader.findMany({
    select: { address: true, totalPnl: true, tradeCount: true, twitterUsername: true, rarityScore: true },
  });
  
  logger.info(`📊 Found ${traders.length} traders`);
  
  const sorted = traders.sort((a, b) => (Number(b.totalPnl) || 0) - (Number(a.totalPnl) || 0));
  let updated = 0;
  let broken = 0;
  
  for (let i = 0; i < sorted.length; i++) {
    const trader = sorted[i];
    const rank = i + 1;
    const newScore = calculateRarityScore(
      Number(trader.totalPnl) || 0,
      0,
      trader.tradeCount || 0,
      rank,
      !!trader.twitterUsername
    );
    
    if (trader.rarityScore > 1000 && broken < 5) {
      logger.info(`  🔧 Fixing: ${trader.address.slice(0, 10)}... | ${trader.rarityScore} → ${newScore}`);
      broken++;
    }
    
    await prisma.trader.update({
      where: { address: trader.address },
      data: { rarityScore: newScore },
    });
    updated++;
    
    if (updated % 100 === 0) {
      logger.info(`  Progress: ${updated}/${sorted.length}...`);
    }
  }
  
  logger.info(`✅ Score recalculation complete! Updated ${updated} traders`);
}

