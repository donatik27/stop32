import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const traders = await prisma.trader.findMany({
      select: {
        address: true,
        displayName: true,
        profilePicture: true,
        twitterUsername: true,
        tier: true,
        rarityScore: true,
        realizedPnl: true,
        totalPnl: true,
        winRate: true,
        tradeCount: true,
      },
      orderBy: { totalPnl: 'desc' },
      take: 1000,
    })

    const formattedTraders = traders.map(t => ({
      address: t.address,
      displayName: t.displayName || 'Unknown Trader',
      avatar: t.profilePicture || `https://api.dicebear.com/7.x/shapes/svg?seed=${t.address}`,
      tier: t.tier,
      rarityScore: t.rarityScore,
      estimatedPnL: Number(t.realizedPnl),
      volume: 0,
      winRate: t.winRate,
      tradeCount: t.tradeCount,
      verified: !!t.twitterUsername,
      xUsername: t.twitterUsername,
    }))

    return NextResponse.json(formattedTraders)
  } catch (error) {
    console.error('Failed to fetch traders:', error)
    return NextResponse.json({ error: 'Failed to fetch traders' }, { status: 500 })
  }
}
