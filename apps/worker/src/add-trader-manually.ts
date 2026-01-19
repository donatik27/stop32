import { prisma } from '@polymarket/database';
import { logger } from './lib/logger';

/**
 * MANUAL: Додаємо трейдера вручну
 * 
 * Використання:
 * pnpm tsx src/add-trader-manually.ts <polymarket_address> <twitter_handle> <country>
 * 
 * Приклад:
 * pnpm tsx src/add-trader-manually.ts 0x1234...abcd JohnDoe "United States"
 */

interface TraderInput {
  address: string;
  twitterHandle: string;
  country: string;
}

// Country coordinates mapping
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  'United States': { lat: 37.0902, lon: -95.7129 },
  'United Kingdom': { lat: 55.3781, lon: -3.4360 },
  'Germany': { lat: 51.1657, lon: 10.4515 },
  'Canada': { lat: 56.1304, lon: -106.3468 },
  'Australia': { lat: -25.2744, lon: 133.7751 },
  'Brazil': { lat: -14.2350, lon: -51.9253 },
  'Japan': { lat: 36.2048, lon: 138.2529 },
  'Korea': { lat: 37.5665, lon: 126.9780 },
  'Hong Kong': { lat: 22.3193, lon: 114.1694 },
  'Spain': { lat: 40.4637, lon: -3.7492 },
  'Italy': { lat: 41.8719, lon: 12.5674 },
  'Netherlands': { lat: 52.1326, lon: 5.2913 },
  'Poland': { lat: 51.9194, lon: 19.1451 },
  'France': { lat: 46.2276, lon: 2.2137 },
  'Turkey': { lat: 38.9637, lon: 35.2433 },
  'Thailand': { lat: 15.8700, lon: 100.9925 },
  'Indonesia': { lat: -0.7893, lon: 113.9213 },
  'Europe': { lat: 50.0, lon: 10.0 },
  'East Asia': { lat: 35.0, lon: 105.0 },
  'West Asia': { lat: 29.0, lon: 53.0 },
};

async function addTraderManually(input: TraderInput) {
  logger.info('➕ Adding trader manually...');
  logger.info(`   Address: ${input.address}`);
  logger.info(`   Twitter: @${input.twitterHandle}`);
  logger.info(`   Country: ${input.country}`);
  
  try {
    // 1. Fetch trader data from Polymarket API
    const leaderboardRes = await fetch(
      `https://data-api.polymarket.com/v1/leaderboard?timePeriod=month&orderBy=PNL&limit=1000`
    );
    
    if (!leaderboardRes.ok) {
      throw new Error('Failed to fetch Polymarket leaderboard');
    }
    
    const leaderboard = await leaderboardRes.json();
    const traderData = leaderboard.find((t: any) => 
      t.proxyWallet?.toLowerCase() === input.address.toLowerCase()
    );
    
    if (!traderData) {
      throw new Error(`Trader ${input.address} not found in Polymarket leaderboard`);
    }
    
    logger.info(`✅ Found trader data: ${traderData.userName || 'Unknown'}`);
    logger.info(`   PnL: $${traderData.pnl?.toLocaleString() || 0}`);
    logger.info(`   Volume: $${traderData.volume?.toLocaleString() || 0}`);
    
    // 2. Get coordinates for country
    const coords = COUNTRY_COORDS[input.country];
    if (!coords) {
      logger.warn(`⚠️  Country "${input.country}" not found in mapping. Available countries:`);
      Object.keys(COUNTRY_COORDS).forEach(c => logger.warn(`   - ${c}`));
      throw new Error(`Country "${input.country}" not found`);
    }
    
    // Add random offset to avoid exact overlap
    const latOffset = (Math.random() - 0.5) * 2;
    const lonOffset = (Math.random() - 0.5) * 2;
    
    // 3. Save to database
    const trader = await prisma.trader.upsert({
      where: { address: traderData.proxyWallet },
      create: {
        address: traderData.proxyWallet,
        displayName: traderData.userName || `${traderData.proxyWallet?.slice(0, 6)}...`,
        profilePicture: traderData.profileImage || null,
        twitterUsername: input.twitterHandle,
        tier: 'S', // All manually added traders are S-tier
        realizedPnl: traderData.pnl || 0,
        totalPnl: traderData.pnl || 0,
        tradeCount: traderData.markets_traded || 0,
        winRate: 0, // Will be calculated later
        rarityScore: Math.floor((traderData.pnl || 0) + (traderData.volume || 0) * 0.1),
        latitude: coords.lat + latOffset,
        longitude: coords.lon + lonOffset,
        country: input.country,
        lastActiveAt: new Date(),
      },
      update: {
        displayName: traderData.userName || undefined,
        profilePicture: traderData.profileImage || undefined,
        twitterUsername: input.twitterHandle,
        tier: 'S',
        realizedPnl: traderData.pnl || 0,
        totalPnl: traderData.pnl || 0,
        tradeCount: traderData.markets_traded || 0,
        rarityScore: Math.floor((traderData.pnl || 0) + (traderData.volume || 0) * 0.1),
        latitude: coords.lat + latOffset,
        longitude: coords.lon + lonOffset,
        country: input.country,
        lastActiveAt: new Date(),
      }
    });
    
    logger.info('✅ Trader saved to database!');
    logger.info(`   ID: ${trader.id}`);
    logger.info(`   Name: ${trader.displayName}`);
    logger.info(`   Location: ${input.country} (${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)})`);
    
    return trader;
    
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to add trader');
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('❌ Usage: pnpm tsx src/add-trader-manually.ts <address> <twitter_handle> <country>');
  console.error('');
  console.error('Example:');
  console.error('  pnpm tsx src/add-trader-manually.ts 0x1234...abcd JohnDoe "United States"');
  console.error('');
  console.error('Available countries:');
  Object.keys(COUNTRY_COORDS).forEach(c => console.error(`  - ${c}`));
  process.exit(1);
}

const [address, twitterHandle, ...countryParts] = args;
const country = countryParts.join(' ');

addTraderManually({ address, twitterHandle, country })
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
