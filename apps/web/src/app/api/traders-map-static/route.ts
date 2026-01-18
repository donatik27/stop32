import { NextResponse } from 'next/server';
import { STATIC_MAPPED_TRADERS } from '@/lib/static-traders';
import { prisma } from '@polymarket/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch real traders from database
    const dbTraders = await prisma.trader.findMany({
      where: {
        twitterUsername: {
          not: null,
        },
      },
      select: {
        address: true,
        displayName: true,
        profilePicture: true,
        twitterUsername: true,
        tier: true,
        totalPnl: true,
        rarityScore: true,
      },
    });

    // Create a map of Twitter username -> real trader data
    const traderMap = new Map(
      dbTraders.map((t) => [
        t.twitterUsername?.toLowerCase(),
        t,
      ])
    );

    // Merge static coordinates with real trader data
    const traders = STATIC_MAPPED_TRADERS.map((t) => {
      const realTrader = traderMap.get(t.xUsername?.toLowerCase() || '');

      if (realTrader) {
        // Use real trader data with static coordinates
        return {
          address: realTrader.address, // Real address
          displayName: realTrader.displayName || t.displayName,
          profilePicture: realTrader.profilePicture || t.avatar, // Prefer real avatar
          tier: realTrader.tier,
          xUsername: t.xUsername,
          latitude: t.latitude, // Static coordinates
          longitude: t.longitude, // Static coordinates
          country: t.country,
          totalPnl: Number(realTrader.totalPnl), // Real PnL
          rarityScore: realTrader.rarityScore,
        };
      }

      // Fallback to static data if trader not in DB
      return {
        address: t.address,
        displayName: t.displayName,
        profilePicture: t.avatar,
        tier: t.tier,
        xUsername: t.xUsername,
        latitude: t.latitude,
        longitude: t.longitude,
        country: t.country,
        totalPnl: t.totalPnl,
        rarityScore: t.rarityScore,
      };
    });

    return NextResponse.json(traders);
  } catch (error) {
    console.error('Failed to fetch traders:', error);
    // Fallback to static data on error
    const traders = STATIC_MAPPED_TRADERS.map((t) => ({
      address: t.address,
      displayName: t.displayName,
      profilePicture: t.avatar,
      tier: t.tier,
      xUsername: t.xUsername,
      latitude: t.latitude,
      longitude: t.longitude,
      country: t.country,
      totalPnl: t.totalPnl,
      rarityScore: t.rarityScore,
    }));

    return NextResponse.json(traders);
  }
}
