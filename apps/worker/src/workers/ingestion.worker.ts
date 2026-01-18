import { JobData } from '../lib/queue';
import { logger } from '../lib/logger';
import prisma from '@polymarket/database';

export async function handleIngestionJob(data: JobData) {
  switch (data.type) {
    case 'sync-leaderboard':
      await syncLeaderboard(data.payload);
      break;
    case 'sync-markets':
      await syncMarkets(data.payload);
      break;
    case 'sync-map-traders':
      await syncMapTraders(data.payload);
      break;
    case 'sync-trader-trades':
      await syncTraderTrades(data.payload);
      break;
    case 'sync-trader-positions':
      await syncTraderPositions(data.payload);
      break;
    default:
      logger.warn({ type: data.type }, 'Unknown ingestion job type');
  }
}

// Tier assignment function
function assignTier(trader: any, leaderboard: any[]) {
  const rank = leaderboard.findIndex(t => t.proxyWallet === trader.proxyWallet) + 1;
  const totalTraders = leaderboard.length;
  const percentile = rank / totalTraders;
  
  // Check if trader is public/verified
  const isPublic = trader.xUsername || trader.verifiedBadge;
  
  // Only 3 tiers: S, A, B
  // S-tier: Top 10% OR public/verified traders
  if (isPublic || percentile <= 0.10) return 'S';
  
  // A-tier: Top 40%
  if (percentile <= 0.40) return 'A';
  
  // B-tier: Everyone else (top 1000)
  return 'B';
}

async function syncLeaderboard(payload: any) {
  logger.info('🚀 Syncing leaderboard from MULTIPLE time periods...');
  
  try {
    const traderMap = new Map<string, any>(); // address -> trader data
    
    // Fetch traders from different time periods to maximize coverage
    const periods = [
      { name: 'day', limit: 100 },
      { name: 'week', limit: 500 },
      { name: 'month', limit: 1000 },
      { name: 'all', limit: 1000 },
    ];
    
    for (const period of periods) {
      logger.info(`📥 Fetching top ${period.limit} traders from ${period.name.toUpperCase()} leaderboard...`);
      
      const BATCH_SIZE = 100;
      let periodTraders = 0;
      
      for (let offset = 0; offset < period.limit; offset += BATCH_SIZE) {
        const res = await fetch(
          `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${period.name}&orderBy=PNL&limit=${BATCH_SIZE}&offset=${offset}`
        );
        
        if (!res.ok) {
          logger.error({ status: res.status, period: period.name }, 'Polymarket API error');
          break;
        }
        
        const batch = await res.json();
        
        if (batch.length === 0) {
          logger.info(`   ⚠️  Reached end of ${period.name} leaderboard at ${periodTraders} traders`);
          break;
        }
        
        // Add to map (deduplicate by address)
        for (const t of batch) {
          if (t.proxyWallet && !traderMap.has(t.proxyWallet)) {
            traderMap.set(t.proxyWallet, t);
            periodTraders++;
          }
        }
        
        logger.info(`   ✓ Fetched ${batch.length} traders from ${period.name} (new: ${periodTraders}, total unique: ${traderMap.size})`);
        
        // Small pause to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      logger.info(`✅ ${period.name.toUpperCase()} complete: ${periodTraders} new traders (total unique: ${traderMap.size})`);
    }
    
    const allTraders = Array.from(traderMap.values());
    logger.info(`✅ Fetched ${allTraders.length} UNIQUE traders across all time periods`);
    
    if (allTraders.length < 1000) {
      logger.warn(`⚠️  Only fetched ${allTraders.length} unique traders (expected 1000+)`);
    }
    
    // Assign tiers and save to DB
    logger.info('💾 Saving traders to database...');
    let saved = 0;
    
    // Save traders to DB (use profileImage from API, NOT profilePicture!)
    for (const t of allTraders) {
      if (!t.proxyWallet) continue;
      
      try {
        // Leaderboard API returns 'profileImage', not 'profilePicture'
        const profilePic = t.profileImage || null;
        
        // Extract volume and markets_traded from API
        const volume = t.volume || 0;
        const marketsTraded = t.markets_traded || 0;
        
        // Calculate win rate (if API provides profitable markets count)
        // Note: Polymarket API doesn't directly provide win rate, so we estimate
        // Win rate = profitable trades / total trades (simplified)
        const winRate = marketsTraded > 0 && t.pnl > 0 
          ? Math.min(((t.pnl / volume) * 100), 100) // Estimate based on PnL/Volume ratio
          : 0;
        
        await prisma.trader.upsert({
          where: { address: t.proxyWallet },
          create: {
            address: t.proxyWallet,
            displayName: t.userName || `${t.proxyWallet?.slice(0, 6)}...`,
            profilePicture: profilePic,
            twitterUsername: t.xUsername || null,
            tier: assignTier(t, allTraders),
            realizedPnl: t.pnl || 0,
            totalPnl: t.pnl || 0,
            volume: volume,
            tradeCount: marketsTraded,
            winRate: winRate,
            rarityScore: Math.floor((t.pnl || 0) + (volume * 0.1)), // Simple score based on PnL + Volume
          },
          update: {
            displayName: t.userName || undefined,
            profilePicture: profilePic || undefined,
            twitterUsername: t.xUsername || undefined,
            tier: assignTier(t, allTraders),
            realizedPnl: t.pnl || 0,
            totalPnl: t.pnl || 0,
            volume: volume,
            tradeCount: marketsTraded,
            winRate: winRate,
            rarityScore: Math.floor((t.pnl || 0) + (volume * 0.1)),
            lastActiveAt: new Date(),
          },
        });
        saved++;
      } catch (error: any) {
        logger.error({ error: error.message, address: t.proxyWallet }, 'Failed to save trader');
      }
    }
    
    logger.info(`💾 Saved ${saved} traders to database`);
    
    // Count traders with/without profile pictures
    const withPics = allTraders.filter(t => t.profileImage).length;
    const withoutPics = allTraders.length - withPics;
    logger.info(`📸 Profile pictures: ${withPics} with images, ${withoutPics} without`);
    
    // Count by tier
    const counts = await prisma.trader.groupBy({
      by: ['tier'],
      _count: { tier: true },
    });
    
    logger.info('📊 Tier distribution:');
    for (const c of counts) {
      logger.info(`   ${c.tier}-tier: ${c._count.tier}`);
    }
    
    // Update ingestion state
  await prisma.ingestionState.upsert({
    where: {
      source_key: {
        source: 'leaderboard',
        key: 'global',
      },
    },
    create: {
      source: 'leaderboard',
      key: 'global',
      lastTimestamp: new Date(),
    },
    update: {
      lastTimestamp: new Date(),
    },
  });
  
    logger.info(`✅ Leaderboard sync completed! Saved ${saved} traders`);
    
    // 🗺️ ONE-TIME: Add geolocation if not already done
    const tradersWithLocation = await prisma.trader.count({
      where: {
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } },
        ],
      },
    });
    
    logger.info(`📍 Traders with geolocation: ${tradersWithLocation}`);
    
    // If less than 50 traders have geolocation, run it once
    if (tradersWithLocation < 50) {
      logger.info('🗺️  Running one-time geolocation setup...');
      await addGeolocation();
    }
  } catch (error: any) {
    logger.error({ error: error.message }, 'Leaderboard sync failed');
    throw error;
  }
}

// Geolocation logic (runs once when needed)
async function addGeolocation() {
  const LOCATION_COORDS: Record<string, { lat: number; lon: number }> = {
    'Germany': { lat: 51.1657, lon: 10.4515 },
    'Europe': { lat: 50.0, lon: 10.0 },
    'Brazil': { lat: -14.2350, lon: -51.9253 },
    'Italy': { lat: 41.8719, lon: 12.5674 },
    'East Asia & Pacific': { lat: 35.0, lon: 105.0 },
    'United States': { lat: 37.0902, lon: -95.7129 },
    'Spain': { lat: 40.4637, lon: -3.7492 },
    'Australasia': { lat: -25.0, lon: 135.0 },
    'Australia': { lat: -25.2744, lon: 133.7751 },
    'Hong Kong': { lat: 22.3193, lon: 114.1694 },
    'United Kingdom': { lat: 55.3781, lon: -3.4360 },
    'Korea': { lat: 37.5665, lon: 126.9780 },
    'Japan': { lat: 36.2048, lon: 138.2529 },
    'Lithuania': { lat: 55.1694, lon: 23.8813 },
    'Canada': { lat: 56.1304, lon: -106.3468 },
    'Denmark': { lat: 56.2639, lon: 9.5018 },
    'Thailand': { lat: 15.8700, lon: 100.9925 },
    'Slovakia': { lat: 48.6690, lon: 19.6990 },
    'Morocco': { lat: 31.7917, lon: -7.0926 },
    'Estonia': { lat: 58.5953, lon: 25.0136 },
    'Turkey': { lat: 38.9637, lon: 35.2433 },
    'Indonesia': { lat: -0.7893, lon: 113.9213 },
    'West Asia': { lat: 29.0, lon: 53.0 },
    'Poland': { lat: 51.9194, lon: 19.1451 },
    'Austria': { lat: 47.5162, lon: 14.5501 },
    'North America': { lat: 54.5260, lon: -105.2551 },
    'Netherlands': { lat: 52.1326, lon: 5.2913 },
    'Ireland': { lat: 53.4129, lon: -8.2439 },
  };

  const TRADER_LOCATIONS: Record<string, string> = {
    '0xTactic': 'Germany',
    '0xTrinity': 'Europe',
    'AbrahamKurland': 'Brazil',
    'AnjunPoly': 'Italy',
    'AnselFang': 'East Asia & Pacific',
    'BeneGesseritPM': 'United States',
    'Betwick1': 'Spain',
    'BitalikWuterin': 'Australasia',
    'BrokieTrades': 'United States',
    'CUTNPASTE4': 'Australia',
    'Cabronidus': 'Spain',
    'CarOnPolymarket': 'Europe',
    'ColeBartiromo': 'United States',
    'Domahhhh': 'Ireland',
    'Dyor_0x': 'United Kingdom',
    'Eltonma': 'Hong Kong',
    'EricZhu06': 'United States',
    'Ferzinhagianola': 'United Kingdom',
    'Foster': 'United States',
    'HanRiverVictim': 'Korea',
    'HarveyMackinto2': 'Japan',
    'IceFrosst': 'Lithuania',
    'Impij25': 'Canada',
    'IqDegen': 'Germany',
    'JJo3999': 'Australia',
    'Junk3383': 'Korea',
    'LegenTrader86': 'Hong Kong',
    'MiSTkyGo': 'Europe',
    'MrOziPM': 'Denmark',
    'ParkDae_gangnam': 'Thailand',
    'PatroclusPoly': 'Canada',
    'SnoorrrasonPoly': 'Slovakia',
    'UjxTCY7Z7ftjiNq': 'Korea',
    'XPredicter': 'Morocco',
    'biancalianne418': 'Japan',
    'bitcoinzhang1': 'Japan',
    'cripes3': 'Spain',
    'cynical_reason': 'Estonia',
    'debased_PM': 'Turkey',
    'denizz_poly': 'Indonesia',
    'drewlivanos': 'United States',
    'dw8998': 'East Asia & Pacific',
    'evan_semet': 'United States',
    'feverpromotions': 'Japan',
    'fortaellinger': 'West Asia',
    'holy_moses7': 'West Asia',
    'hypsterlo': 'Poland',
    'johnleftman': 'United States',
    'jongpatori': 'Korea',
    'joselebetis2': 'Australia',
    'love_u_4ever': 'Hong Kong',
    'one8tyfive': 'Austria',
    'smdx_btc': 'United States',
    'tulipking': 'North America',
    'vacoolaaaa': 'Netherlands',
    'videlake': 'Hong Kong',
    'wkmfa57': 'Hong Kong',
  };

  try {
    const traders = await prisma.trader.findMany({
      where: {
        twitterUsername: { not: null },
        latitude: null, // Only update those without location
      },
      select: {
        address: true,
        twitterUsername: true,
      },
    });

    logger.info(`🗺️  Found ${traders.length} traders needing geolocation`);

    let updated = 0;
    for (const trader of traders) {
      if (!trader.twitterUsername) continue;

      const location = TRADER_LOCATIONS[trader.twitterUsername];
      if (!location) continue;

      const coords = LOCATION_COORDS[location];
      if (!coords) continue;

      // Add small random offset to avoid exact overlap
      const latOffset = (Math.random() - 0.5) * 2;
      const lonOffset = (Math.random() - 0.5) * 2;

      await prisma.trader.update({
        where: { address: trader.address },
        data: {
          latitude: coords.lat + latOffset,
          longitude: coords.lon + lonOffset,
          country: location,
        },
      });

      updated++;
    }

    logger.info(`✅ Geolocation complete! Updated ${updated} traders`);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Geolocation failed');
  }
}

async function syncMarkets(payload: any) {
  logger.info('🔄 Syncing markets...');
  
  try {
    const res = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=500');
    
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    
    const markets = await res.json();
    logger.info(`📥 Fetched ${markets.length} active markets`);
    
    let saved = 0;
    for (const m of markets) {
      if (!m.id) continue;
      
      try {
        await prisma.market.upsert({
          where: { id: m.id },
          create: {
            id: m.id,
            question: m.question || 'Unknown',
            category: m.category || 'Uncategorized',
            eventSlug: m.eventSlug || null,
            slug: m.slug || null,
            endDate: m.endDate ? new Date(m.endDate) : null,
            liquidity: m.liquidityNum || 0,
            volume: m.volumeNum || 0,
            status: m.closed ? 'CLOSED' : 'OPEN',
          },
          update: {
            question: m.question || undefined,
            category: m.category || undefined,
            eventSlug: m.eventSlug || undefined,
            slug: m.slug || undefined,
            endDate: m.endDate ? new Date(m.endDate) : undefined,
            liquidity: m.liquidityNum || undefined,
            volume: m.volumeNum || undefined,
            status: m.closed ? 'CLOSED' : 'OPEN',
          },
        });
        saved++;
      } catch (error: any) {
        logger.error({ error: error.message, marketId: m.id }, 'Failed to save market');
      }
    }
    
    // Update ingestion state
  await prisma.ingestionState.upsert({
    where: {
      source_key: {
        source: 'markets',
        key: 'all',
      },
    },
    create: {
      source: 'markets',
      key: 'all',
      lastTimestamp: new Date(),
    },
    update: {
      lastTimestamp: new Date(),
    },
  });
  
    logger.info(`✅ Markets sync completed! Saved ${saved} markets`);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Markets sync failed');
    throw error;
  }
}

async function syncTraderTrades(payload: any) {
  logger.info({ trader: payload?.traderId }, 'Syncing trader trades...');
  // TODO: Implement if needed for detailed trader profiles
  logger.info('Trader trades sync completed (stub)');
}

async function syncTraderPositions(payload: any) {
  logger.info({ trader: payload?.traderId }, 'Syncing trader positions...');
  // TODO: Implement if needed for detailed trader profiles
  logger.info('Trader positions sync completed (stub)');
}

async function syncMapTraders(payload: any) {
  logger.info('🗺️  Syncing map traders to database...');
  
  // Map traders Twitter usernames (from static-traders.ts)
  const MAP_TRADERS_USERNAMES = [
    '0xTactic', '0xTrinity', 'AbrahamKurland', 'AnjunPoly', 'AnselFang',
    'BeneGesseritPM', 'Betwick1', 'BitalikWuterin', 'BrokieTrades', 'CUTNPASTE4',
    'Cabronidus', 'CarOnPolymarket', 'ColeBartiromo', 'Domahhhh', 'Dyor_0x',
    'Eltonma', 'EricZhu06', 'Ferzinhagianola', 'Foster', 'HanRiverVictim',
    'HarveyMackinto2', 'IceFrosst', 'Impij25', 'IqDegen', 'JJo3999',
    'Junk3383', 'LegenTrader86', 'MiSTkyGo', 'MrOziPM', 'ParkDae_gangnam',
    'PatroclusPoly', 'SnoorrrasonPoly', 'UjxTCY7Z7ftjiNq', 'XPredicter', 'biancalianne418',
    'bitcoinzhang1', 'cripes3', 'cynical_reason', 'debased_PM', 'denizz_poly',
    'drewlivanos', 'dw8998', 'evan_semet', 'feverpromotions', 'fortaellinger',
    'holy_moses7', 'hypsterlo', 'johnleftman', 'jongpatori', 'joselebetis2',
    'love_u_4ever', 'one8tyfive', 'smdx_btc', 'tulipking', 'vacoolaaaa',
    'videlake', 'wkmfa57',
  ];
  
  try {
    let found = 0;
    let notFound = 0;
    
    // Search in multiple time periods to maximize coverage
    const periods = ['day', 'week', 'month', 'all'];
    
    for (const username of MAP_TRADERS_USERNAMES) {
      let traderFound = false;
      
      for (const period of periods) {
        try {
          // Search in Polymarket leaderboard for this username
          const res = await fetch(
            `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${period}&orderBy=PNL&limit=2000`
          );
          
          if (!res.ok) {
            continue;
          }
          
          const traders = await res.json();
          
          // Find trader by Twitter username (case-insensitive)
          const trader = traders.find((t: any) => 
            t.xUsername?.toLowerCase() === username.toLowerCase()
          );
          
          if (trader && trader.proxyWallet) {
            // Check if already in DB
            const existing = await prisma.trader.findUnique({
              where: { address: trader.proxyWallet },
            });
            
            if (existing) {
              logger.info(`   ✓ Trader @${username} already in DB (${trader.proxyWallet})`);
              found++;
              traderFound = true;
              break;
            }
            
            // Add to DB
            const volume = trader.volume || 0;
            const marketsTraded = trader.markets_traded || 0;
            const winRate = marketsTraded > 0 && trader.pnl > 0 
              ? Math.min(((trader.pnl / volume) * 100), 100)
              : 0;
            
            await prisma.trader.upsert({
              where: { address: trader.proxyWallet },
              create: {
                address: trader.proxyWallet,
                displayName: trader.userName || `${trader.proxyWallet?.slice(0, 6)}...`,
                profilePicture: trader.profileImage || null,
                twitterUsername: trader.xUsername || null,
                tier: assignTier(trader, []),
                realizedPnl: trader.pnl || 0,
                totalPnl: trader.pnl || 0,
                volume: volume,
                tradeCount: marketsTraded,
                winRate: winRate,
                rarityScore: Math.floor((trader.pnl || 0) + (volume * 0.1)),
              },
              update: {
                displayName: trader.userName || undefined,
                profilePicture: trader.profileImage || undefined,
                twitterUsername: trader.xUsername || undefined,
                tier: assignTier(trader, []),
                realizedPnl: trader.pnl || 0,
                totalPnl: trader.pnl || 0,
                volume: volume,
                tradeCount: marketsTraded,
                winRate: winRate,
                rarityScore: Math.floor((trader.pnl || 0) + (volume * 0.1)),
                lastActiveAt: new Date(),
              },
            });
            
            logger.info(`   ✅ Added @${username} to DB (${trader.proxyWallet}, PnL: $${(trader.pnl / 1000).toFixed(1)}K)`);
            found++;
            traderFound = true;
            break;
          }
        } catch (error: any) {
          logger.error({ error: error.message, username, period }, 'Error searching for trader');
        }
        
        // Small delay between periods
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (!traderFound) {
        logger.warn(`   ⚠️  Trader @${username} not found in any leaderboard`);
        notFound++;
      }
      
      // Delay between traders to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.info(`✅ Map trader sync complete: ${found} found, ${notFound} not found`);
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Map trader sync failed');
    throw error;
  }
}
