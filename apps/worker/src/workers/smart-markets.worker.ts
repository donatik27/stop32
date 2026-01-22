/**
 * ========================================
 * ALPHA MARKETS WORKER - REBUILT FROM SCRATCH
 * ========================================
 * 
 * SIMPLE & CLEAN IMPLEMENTATION:
 * 
 * 1. FETCH 500 markets from Polymarket API
 * 2. FILTER: exclude Closed, past endDate, 95%+ price
 * 3. ANALYZE: check S/A/B tier traders' on-chain positions
 * 4. SAVE: markets with 2+ traders having positions
 * 5. DISPLAY: top-10 traders with full data (name, tier, side, shares, price, amount)
 * 
 * NO PINNED SYSTEM - just sort all markets by score and show top-50
 */

import { JobData } from '../lib/queue';

import { createPublicClient, http, encodeFunctionData, formatUnits } from 'viem';
import { polygon } from 'viem/chains';
import { prisma } from '@polymarket/database';
import { logger } from '../lib/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

const CTF_CONTRACT = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045' as `0x${string}`;
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as `0x${string}`;

const CTF_ABI = [{
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'id', type: 'uint256' }
  ],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}] as const;

const MULTICALL3_ABI = [{
  inputs: [{ 
    components: [
      { name: 'target', type: 'address' },
      { name: 'callData', type: 'bytes' }
    ],
    name: 'calls',
    type: 'tuple[]'
  }],
  name: 'aggregate',
  outputs: [
    { name: 'blockNumber', type: 'uint256' },
    { name: 'returnData', type: 'bytes[]' }
  ],
  stateMutability: 'view',
  type: 'function'
}] as const;

// ============================================================================
// TYPES
// ============================================================================

interface Trader {
  address: string;
  displayName: string | null;
  tier: 'S' | 'A' | 'B';
  realizedPnl: any;
}

interface TraderPosition {
  address: string;
  displayName: string | null;
  tier: 'S' | 'A' | 'B';
  side: 'YES' | 'NO';
  shares: number;
  entryPrice: number;
}

interface MarketAnalysis {
  smartCount: number;
  smartWeighted: number;
  smartScore: number;
  topTraders: TraderPosition[];
}

// ============================================================================
// JOB HANDLER
// ============================================================================

export async function handleSmartMarketsJob(data: JobData) {
  switch (data.type) {
    case 'discover-new-markets':
      await discoverAlphaMarkets();
      break;
    case 'analyze-multi-outcome':
      // Keep multi-outcome analysis (separate worker)
      const { analyzeMultiOutcomeEvents } = await import('./multi-outcome.worker');
      await analyzeMultiOutcomeEvents();
      break;
    default:
      logger.warn({ type: data.type }, 'Unknown smart markets job type');
  }
}

// ============================================================================
// MAIN JOB: DISCOVER ALPHA MARKETS
// ============================================================================

async function discoverAlphaMarkets() {
  const startTime = Date.now();
  logger.info('🚀 STARTING ALPHA MARKETS DISCOVERY (REBUILT VERSION)');
  
  try {
    // STEP 1: Fetch S/A/B tier traders from database
    logger.info('📥 STEP 1: Loading S/A/B tier traders...');
    const allTraders = await prisma.trader.findMany({
      where: {
        tier: { in: ['S', 'A', 'B'] }
      },
      select: {
        address: true,
        displayName: true,
        tier: true,
        realizedPnl: true
      }
    });
    
    logger.info(`   ✅ Loaded ${allTraders.length} traders (S: ${allTraders.filter(t => t.tier === 'S').length}, A: ${allTraders.filter(t => t.tier === 'A').length}, B: ${allTraders.filter(t => t.tier === 'B').length})`);
    
    // STEP 2: Fetch 500 markets from Polymarket API
    logger.info('📥 STEP 2: Fetching 500 markets from Polymarket...');
    const marketsRes = await fetch('https://gamma-api.polymarket.com/markets?limit=500&closed=false&order=volume&ascending=false');
    const allMarkets = await marketsRes.json();
    logger.info(`   ✅ Fetched ${allMarkets.length} markets`);
    
    // STEP 3: Filter markets
    logger.info('🔍 STEP 3: Filtering markets...');
    const now = Date.now();
    const filteredMarkets = allMarkets.filter((m: any) => {
      // Exclude closed
      if (m.closed) return false;
      
      // Exclude past endDate
      if (m.endDate) {
        const endDate = new Date(m.endDate).getTime();
        if (endDate < now) return false;
      }
      
      // Exclude 95%+ price (effectively resolved)
      if (m.outcomePrices && Array.isArray(m.outcomePrices)) {
        const prices = m.outcomePrices.map((p: string) => parseFloat(p));
        const hasExtremePrice = prices.some((p: number) => p >= 0.95 || p <= 0.05);
        if (hasExtremePrice) return false;
      }
      
      return true;
    });
    
    logger.info(`   ✅ ${filteredMarkets.length} markets passed filters (${allMarkets.length - filteredMarkets.length} filtered out)`);
    
    // STEP 4: Create RPC client for on-chain data
    const client = createPublicClient({
      chain: polygon,
      transport: http('https://1rpc.io/matic', {
        timeout: 30_000,
        retryCount: 3,
        retryDelay: 1000
      })
    });
    
    // STEP 5: Analyze each market
    logger.info('🔬 STEP 5: Analyzing markets for trader positions...');
    let savedCount = 0;
    
    for (let i = 0; i < filteredMarkets.length; i++) {
      const market = filteredMarkets[i];
      
      try {
        logger.info(`   [${i + 1}/${filteredMarkets.length}] ${market.question.slice(0, 50)}...`);
        
        // Analyze market
        const analysis = await analyzeMarket(client, market, allTraders);
        
        // Save if 2+ traders found
        if (analysis.smartCount >= 2) {
          await saveMarket(market, analysis);
          savedCount++;
          logger.info(`      ✅ SAVED with ${analysis.smartCount} traders`);
        } else {
          logger.info(`      ⏭️  SKIPPED (only ${analysis.smartCount} traders)`);
        }
        
      } catch (error: any) {
        logger.error(`      ❌ ERROR: ${error.message}`);
      }
      
      // Pause between markets to avoid rate limits
      if (i < filteredMarkets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`🎉 DISCOVERY COMPLETE! Saved ${savedCount} Alpha Markets in ${duration}s`);
    
  } catch (error) {
    logger.error({ error }, '❌ Discovery failed');
    throw error;
  }
}

// ============================================================================
// ANALYZE MARKET: Check on-chain positions
// ============================================================================

async function analyzeMarket(
  client: any,
  market: any,
  traders: Trader[]
): Promise<MarketAnalysis> {
  
  // Parse tokenIds
  const tokenIds = JSON.parse(market.clobTokenIds || '[]');
  if (tokenIds.length === 0) {
    throw new Error('No tokenIds');
  }
  
  const isYesNoMarket = tokenIds.length === 2;
  
  // Parse prices
  const outcomePrices = market.outcomePrices 
    ? (typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices)
    : ['0.5', '0.5'];
  
  // Build multicall for ALL traders
  const calls = [];
  for (const trader of traders) {
    for (const tokenId of tokenIds) {
      calls.push({
        target: CTF_CONTRACT,
        callData: encodeFunctionData({
          abi: CTF_ABI,
          functionName: 'balanceOf',
          args: [trader.address as `0x${string}`, BigInt(tokenId)]
        })
      });
    }
  }
  
  // Execute multicall
  const results = await client.readContract({
    address: MULTICALL3,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate',
    args: [calls]
  });
  
  // Parse results
  const tradersWithPositions: TraderPosition[] = [];
  let callIndex = 0;
  
  for (const trader of traders) {
    const balances: number[] = [];
    
    // Read all token balances
    for (let i = 0; i < tokenIds.length; i++) {
      const returnData = results[1][callIndex];
      const balance = returnData ? Number(formatUnits(BigInt(returnData as string), 6)) : 0;
      balances.push(balance);
      callIndex++;
    }
    
    const totalBalance = balances.reduce((sum, b) => sum + b, 0);
    
    // Include trader if they have ANY position (even 0.1 shares)
    if (totalBalance > 0.1) {
      
      // For YES/NO markets, determine side
      if (isYesNoMarket) {
        const yesBalance = balances[0];
        const noBalance = balances[1];
        const yesPrice = parseFloat(outcomePrices[0] || '0.5');
        const noPrice = parseFloat(outcomePrices[1] || '0.5');
        
        const side = yesBalance > noBalance ? 'YES' : 'NO';
        const shares = Math.max(yesBalance, noBalance);
        const entryPrice = side === 'YES' ? yesPrice : noPrice;
        
        tradersWithPositions.push({
          address: trader.address,
          displayName: trader.displayName,
          tier: trader.tier as 'S' | 'A' | 'B',
          side,
          shares,
          entryPrice
        });
      }
    }
  }
  
  // Sort by shares (biggest positions first)
  tradersWithPositions.sort((a, b) => b.shares - a.shares);
  
  // Calculate metrics
  const smartCount = tradersWithPositions.length;
  const smartWeighted = tradersWithPositions.reduce((sum, t) => {
    const tierWeight = t.tier === 'S' ? 5 : t.tier === 'A' ? 3 : 1;
    return sum + tierWeight;
  }, 0);
  const smartScore = smartWeighted * Math.log(1 + (market.volume || 0) / 1000000);
  
  return {
    smartCount,
    smartWeighted,
    smartScore,
    topTraders: tradersWithPositions.slice(0, 10) // TOP-10!
  };
}

// ============================================================================
// SAVE MARKET: Store to database
// ============================================================================

async function saveMarket(market: any, analysis: MarketAnalysis) {
  
  // Create/update Market record
  await prisma.market.upsert({
    where: { id: market.id },
    create: {
      id: market.id,
      question: market.question,
      category: market.category,
      slug: market.slug || null,
      eventSlug: null,
      endDate: market.endDate ? new Date(market.endDate) : null,
      liquidity: market.liquidity || null,
      volume: market.volume || null,
      status: 'OPEN'
    },
    update: {
      question: market.question,
      endDate: market.endDate ? new Date(market.endDate) : null,
      volume: market.volume || null,
      status: 'OPEN'
    }
  });
  
  // Create MarketSmartStats (NO PINNED - just save and sort by score)
  await prisma.marketSmartStats.create({
    data: {
      marketId: market.id,
      smartCount: analysis.smartCount,
      smartWeighted: analysis.smartWeighted,
      smartShare: 0,
      smartScore: analysis.smartScore,
      topSmartTraders: analysis.topTraders, // TOP-10 with full data
      isPinned: false, // No pinned system
      priority: 0,     // No priority needed
      computedAt: new Date()
    }
  });
}

// ============================================================================
// CLEANUP: Remove old market stats (keep only last 48 hours)
// ============================================================================

export async function cleanupOldMarkets() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  const deleted = await prisma.marketSmartStats.deleteMany({
    where: {
      computedAt: { lt: cutoff },
      isPinned: false // Don't delete if somehow pinned
    }
  });
  
  logger.info(`🧹 Cleaned up ${deleted.count} old market stats`);
}
