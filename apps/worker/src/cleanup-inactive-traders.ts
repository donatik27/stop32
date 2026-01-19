import { prisma } from '@polymarket/database';
import { logger } from './lib/logger';

/**
 * CLEANUP: Видаляємо всіх трейдерів крім топ-57 S-tier
 * 
 * Залишаємо тільки:
 * - Топ-57 S-tier трейдерів (вони коректні)
 * - Всі інші видаляємо
 */
async function cleanupInactiveTraders() {
  logger.info('🧹 Starting cleanup: removing inactive traders...');
  
  try {
    // 1. Знаходимо топ-57 S-tier трейдерів (по totalPnl)
    const topSTierTraders = await prisma.trader.findMany({
      where: { tier: 'S' },
      orderBy: { totalPnl: 'desc' },
      take: 57,
      select: { id: true, address: true, displayName: true, totalPnl: true }
    });
    
    logger.info(`✅ Found ${topSTierTraders.length} top S-tier traders to KEEP`);
    
    // Виводимо список трейдерів які залишимо
    console.log('\n📋 KEEPING these traders:');
    topSTierTraders.forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.displayName} (${t.address.slice(0, 8)}...) - $${Number(t.totalPnl).toLocaleString()}`);
    });
    
    // 2. Видаляємо всіх інших трейдерів
    const keepIds = topSTierTraders.map(t => t.id);
    
    const deletedCount = await prisma.trader.deleteMany({
      where: {
        id: { notIn: keepIds }
      }
    });
    
    logger.info(`\n🗑️  DELETED ${deletedCount.count} inactive traders`);
    
    // 3. Статистика після cleanup
    const remainingCount = await prisma.trader.count();
    logger.info(`✅ Remaining traders in DB: ${remainingCount}`);
    
    // 4. Перевіряємо що всі S-tier
    const tierStats = await prisma.trader.groupBy({
      by: ['tier'],
      _count: { tier: true }
    });
    
    console.log('\n📊 Tier distribution after cleanup:');
    tierStats.forEach(stat => {
      console.log(`   ${stat.tier}-tier: ${stat._count.tier}`);
    });
    
    logger.info('\n✅ Cleanup completed successfully!');
    
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Cleanup failed');
    throw error;
  }
}

// Run cleanup
cleanupInactiveTraders()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
