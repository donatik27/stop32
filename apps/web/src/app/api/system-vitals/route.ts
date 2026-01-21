import { NextResponse } from 'next/server'
import { prisma } from '@polymarket/database'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Parallel fetches for speed
    const [
      tradersCount,
      marketsCount,
      polymarketStats,
      dbPingTime
    ] = await Promise.all([
      // Traders count (S/A/B tier)
      prisma.trader.count({
        where: {
          tier: { in: ['S', 'A', 'B'] }
        }
      }),
      
      // Active markets count
      prisma.market.count({
        where: {
          status: 'OPEN'
        }
      }),
      
      // Polymarket 24h stats
      fetch('https://gamma-api.polymarket.com/markets?limit=100&closed=false')
        .then(res => res.json())
        .then((markets: any[]) => {
          const total24hVolume = markets.reduce((sum, m) => sum + (m.volume24hr || 0), 0)
          const totalLiquidity = markets.reduce((sum, m) => sum + (m.liquidity || 0), 0)
          return { total24hVolume, totalLiquidity, activeMarkets: markets.length }
        })
        .catch(() => ({ total24hVolume: 0, totalLiquidity: 0, activeMarkets: 0 })),
      
      // Database ping test
      prisma.$queryRaw`SELECT 1`.then(() => Date.now() - startTime)
    ])

    // Calculate BPM from volume (1M volume = 1 BPM, more exciting!)
    const bpm = Math.max(60, Math.min(180, polymarketStats.total24hVolume / 1_000_000))

    // API response time
    const apiResponseTime = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      vitals: {
        heartbeat: {
          bpm: Math.round(bpm),
          volume24h: polymarketStats.total24hVolume,
          volumeChange: '+12.5%', // TODO: Calculate from historical data
        },
        markets: {
          active: marketsCount,
          total: polymarketStats.activeMarkets,
          liquidity: polymarketStats.totalLiquidity,
        },
        traders: {
          total: tradersCount,
          sTier: 0, // TODO: Add breakdown
          aTier: 0,
          bTier: 0,
        },
        performance: {
          apiResponseTime,
          dbPingTime,
          status: apiResponseTime < 100 ? 'EXCELLENT' : apiResponseTime < 500 ? 'GOOD' : 'SLOW'
        }
      }
    })
  } catch (error) {
    console.error('System vitals error:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      vitals: {
        heartbeat: { bpm: 0, volume24h: 0, volumeChange: '0%' },
        markets: { active: 0, total: 0, liquidity: 0 },
        traders: { total: 0, sTier: 0, aTier: 0, bTier: 0 },
        performance: { apiResponseTime: 0, dbPingTime: 0, status: 'ERROR' }
      }
    }, { status: 500 })
  }
}
