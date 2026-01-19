import 'dotenv/config';
import prisma from '@polymarket/database';
import { logger } from './lib/logger';

// USER WILL PROVIDE THIS LIST
// Format: "https://polymarket.com/profile/USERNAME, Country" or just "USERNAME, Country"
const MANUAL_TRADERS = `

`.trim().split('\n').filter(Boolean);

// Country coordinates
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  'United States': { lat: 37.0902, lon: -95.7129 },
  'Germany': { lat: 51.1657, lon: 10.4515 },
  'Hong Kong': { lat: 22.3193, lon: 114.1694 },
  'United Kingdom': { lat: 55.3781, lon: -3.4360 },
  'Canada': { lat: 56.1304, lon: -106.3468 },
  'Australia': { lat: -25.2744, lon: 133.7751 },
  'Japan': { lat: 36.2048, lon: 138.2529 },
  'Korea': { lat: 37.5665, lon: 126.9780 },
  'Brazil': { lat: -14.2350, lon: -51.9253 },
  'Spain': { lat: 40.4637, lon: -3.7492 },
  'Italy': { lat: 41.8719, lon: 12.5674 },
  'France': { lat: 46.2276, lon: 2.2137 },
  'Netherlands': { lat: 52.1326, lon: 5.2913 },
  'Poland': { lat: 51.9194, lon: 19.1451 },
  'Turkey': { lat: 38.9637, lon: 35.2433 },
  'Indonesia': { lat: -0.7893, lon: 113.9213 },
  'Thailand': { lat: 15.8700, lon: 100.9925 },
  'Morocco': { lat: 31.7917, lon: -7.0926 },
  'Estonia': { lat: 58.5953, lon: 25.0136 },
  'Slovakia': { lat: 48.6690, lon: 19.6990 },
  'Denmark': { lat: 56.2639, lon: 9.5018 },
  'Austria': { lat: 47.5162, lon: 14.5501 },
  'Ireland': { lat: 53.4129, lon: -8.2439 },
  'Lithuania': { lat: 55.1694, lon: 23.8813 },
};

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('📥 ДОДАВАННЯ ТРЕЙДЕРІВ ВРУЧНУ (з Polymarket URLs)');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (MANUAL_TRADERS.length === 0) {
    logger.warn('⚠️  Список порожній! Додай трейдерів у форматі:');
    logger.warn('   https://polymarket.com/profile/USERNAME, Country');
    logger.warn('   або просто: USERNAME, Country');
    await prisma.$disconnect();
    return;
  }
  
  logger.info(`📊 Знайдено ${MANUAL_TRADERS.length} трейдерів у списку`);
  logger.info('');
  
  let added = 0;
  let updated = 0;
  let failed = 0;
  
  for (const line of MANUAL_TRADERS) {
    const [usernameOrUrl, country] = line.split(',').map(s => s.trim());
    
    if (!usernameOrUrl || !country) {
      logger.warn(`⚠️  Неправильний формат: "${line}"`);
      failed++;
      continue;
    }
    
    // Extract username from URL or use as is
    const username = usernameOrUrl.includes('polymarket.com') 
      ? usernameOrUrl.split('/').pop()?.replace('@', '') || usernameOrUrl
      : usernameOrUrl.replace('@', '');
    
    logger.info(`🔍 Обробка: @${username} (${country})...`);
    
    try {
      // Try to find trader in Polymarket leaderboard
      const periods = ['month', 'week', 'all', 'day'];
      let traderData: any = null;
      
      const normalizeUsername = (u: string) => u.replace('@', '').trim().toLowerCase();
      const normalizedUsername = normalizeUsername(username);
      
      for (const period of periods) {
        const res = await fetch(
          `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${period}&orderBy=PNL&limit=1000`
        );
        
        if (res.ok) {
          const traders = await res.json();
          const found = traders.find((t: any) => {
            if (!t.xUsername) return false;
            return normalizeUsername(t.xUsername) === normalizedUsername ||
                   normalizeUsername(t.userName || '') === normalizedUsername ||
                   t.proxyWallet?.toLowerCase() === username.toLowerCase();
          });
          
          if (found) {
            traderData = found;
            logger.info(`   ✓ Знайдено в ${period} leaderboard`);
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (!traderData) {
        logger.warn(`   ❌ Не знайдено в топ-1000: @${username}`);
        failed++;
        continue;
      }
      
      // Get coordinates for country
      const coords = COUNTRY_COORDS[country];
      if (!coords) {
        logger.warn(`   ⚠️  Невідома країна: ${country} (використовую США)`);
      }
      
      const lat = coords?.lat || 37.0902;
      const lon = coords?.lon || -95.7129;
      
      // Add random offset to prevent exact overlap
      const latOffset = (Math.random() - 0.5) * 2; // ±1 degree
      const lonOffset = (Math.random() - 0.5) * 2;
      
      // Calculate data
      const pnl = traderData.pnl || 0;
      const volume = traderData.volume || 0;
      const marketsTraded = traderData.markets_traded || 0;
      const winRate = marketsTraded > 0 && pnl > 0 
        ? Math.min(((pnl / (volume || pnl)) * 100), 75)
        : 50;
      
      // Determine tier
      let tier = 'B';
      if (pnl > 100000 || traderData.xUsername) tier = 'S';
      else if (pnl > 50000) tier = 'A';
      
      // Upsert to database
      const trader = await prisma.trader.upsert({
        where: { address: traderData.proxyWallet },
        update: {
          totalPnl: pnl,
          realizedPnl: pnl,
          profilePicture: traderData.profileImage,
          displayName: traderData.userName,
          twitterUsername: traderData.xUsername,
          tier: tier as any,
          tradeCount: marketsTraded,
          winRate: winRate,
          rarityScore: Math.floor(pnl + (volume * 0.1)),
          latitude: lat + latOffset,
          longitude: lon + lonOffset,
        },
        create: {
          address: traderData.proxyWallet,
          totalPnl: pnl,
          realizedPnl: pnl,
          profilePicture: traderData.profileImage,
          displayName: traderData.userName,
          twitterUsername: traderData.xUsername,
          tier: tier as any,
          tradeCount: marketsTraded,
          winRate: winRate,
          rarityScore: Math.floor(pnl + (volume * 0.1)),
          latitude: lat + latOffset,
          longitude: lon + lonOffset,
        },
      });
      
      if (trader) {
        logger.info(`   ✅ ДОДАНО: @${traderData.xUsername} | ${country} | $${(pnl / 1000).toFixed(1)}K | ${tier}`);
        added++;
      } else {
        logger.info(`   🔄 ОНОВЛЕНО: @${traderData.xUsername}`);
        updated++;
      }
      
    } catch (error: any) {
      logger.error({ error: error.message, username }, '   ❌ Помилка обробки');
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('✅ ГОТОВО!');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`📊 Результати:`);
  logger.info(`   ✅ Додано: ${added}`);
  logger.info(`   🔄 Оновлено: ${updated}`);
  logger.info(`   ❌ Помилки: ${failed}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await prisma.$disconnect();
}

main().catch((error) => {
  logger.error({ error: error.message }, '❌ Script failed');
  process.exit(1);
});
