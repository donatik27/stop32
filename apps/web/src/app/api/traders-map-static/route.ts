import { NextResponse } from 'next/server';
import { STATIC_MAPPED_TRADERS } from '@/lib/static-traders';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Return static traders with coordinates
  // Real data will be fetched client-side or via Railway API if needed
  const traders = STATIC_MAPPED_TRADERS.map(t => ({
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
