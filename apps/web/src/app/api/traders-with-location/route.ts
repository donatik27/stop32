import { NextResponse } from 'next/server'

// Force dynamic rendering - this route needs DATABASE_URL at runtime
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Dynamic import to avoid build issues
    const { prisma } = await import('@polymarket/database')
    
    if (!prisma) {
      throw new Error('Prisma client not available')
    }
    
    // Fetch traders with geolocation data
    const traders = await prisma.trader.findMany({
      where: {
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } },
        ]
      },
      select: {
        address: true,
        displayName: true,
        profilePicture: true,
        tier: true,
        rarityScore: true,
        latitude: true,
        longitude: true,
        country: true,
        totalPnl: true,
        winRate: true,
      },
      orderBy: {
        rarityScore: 'desc'
      }
    })
    
    // Convert Decimal to number for JSON
    const serializedTraders = traders.map((trader: (typeof traders)[number]) => ({
      ...trader,
      totalPnl: Number(trader.totalPnl),
      latitude: trader.latitude,
      longitude: trader.longitude,
    }))
    
    return NextResponse.json(serializedTraders)
  } catch (error) {
    console.error('Failed to fetch traders with location:', error)
    return NextResponse.json({ error: 'Failed to fetch traders' }, { status: 500 })
  }
}
