import 'dotenv/config';
import prisma from '@polymarket/database';
import { logger } from './lib/logger';

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🗑️  ВИДАЛЕННЯ ТРЕЙДЕРІВ З ТІРОМ X (не S/A/B)');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Count traders with tier X
  const tierXCount = await prisma.trader.count({
    where: {
      tier: {
        notIn: ['S', 'A', 'B'],
      },
    },
  });
  
  logger.info(`📊 Знайдено ${tierXCount} трейдерів з тіром X (для видалення)`);
  
  if (tierXCount === 0) {
    logger.info('✅ Нічого видаляти!');
    await prisma.$disconnect();
    return;
  }
  
  // Delete all traders with tier X
  const result = await prisma.trader.deleteMany({
    where: {
      tier: {
        notIn: ['S', 'A', 'B'],
      },
    },
  });
  
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`✅ ВИДАЛЕНО ${result.count} трейдерів з тіром X`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Show remaining counts
  const remainingCounts = await prisma.trader.groupBy({
    by: ['tier'],
    _count: { tier: true },
  });
  
  logger.info('');
  logger.info('📊 Залишилось трейдерів по тірам:');
  for (const c of remainingCounts) {
    logger.info(`   ${c.tier}-tier: ${c._count.tier}`);
  }
  
  await prisma.$disconnect();
}

main().catch((error) => {
  logger.error({ error: error.message }, '❌ Script failed');
  process.exit(1);
});
