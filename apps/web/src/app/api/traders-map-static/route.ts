import { NextResponse } from 'next/server';
import { STATIC_MAPPED_TRADERS } from '@/lib/static-traders';

export const dynamic = 'force-dynamic';

export async function GET() {
  const API_BASE_URL = process.env.API_BASE_URL;

  // Prepare static traders data
  const staticTraders = STATIC_MAPPED_TRADERS.map(t => ({
    address: t.address,
    displayName: t.displayName,
    avatar: t.avatar,
    tier: t.tier,
    xUsername: t.xUsername,
    latitude: t.latitude,
    longitude: t.longitude,
    country: t.country,
    totalPnl: t.totalPnl,
    rarityScore: t.rarityScore,
    winRate: t.winRate,
  }));

  // If Railway API is available, enrich data with real trader info
  if (API_BASE_URL) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/traders-map-enriched`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traders: staticTraders }),
      });

      if (response.ok) {
        const enrichedTraders = await response.json();
        // Return enriched traders (real PnL, real addresses, real avatars)
        return NextResponse.json(enrichedTraders.map((t: any) => ({
          address: t.address,
          displayName: t.displayName,
          profilePicture: t.profilePicture,
          tier: t.tier,
          xUsername: t.xUsername,
          latitude: t.latitude,
          longitude: t.longitude,
          country: t.country,
          totalPnl: t.totalPnl,
          rarityScore: t.rarityScore,
          winRate: t.winRate,
        })));
      }
    } catch (error) {
      console.error('Failed to enrich map data:', error);
      // Fall through to return static data
    }
  }

  // Fallback: return static data
  return NextResponse.json(staticTraders.map(t => ({
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
    winRate: t.winRate,
  })));
}
