import { NextResponse } from 'next/server';
import { STATIC_MAPPED_TRADERS } from '@/lib/static-traders';

export const dynamic = 'force-static';

export async function GET() {
  // Map avatar → profilePicture for compatibility with map component
  const traders = STATIC_MAPPED_TRADERS.map(t => ({
    address: t.address,
    displayName: t.displayName,
    profilePicture: t.avatar, // Map avatar to profilePicture
    tier: t.tier,
    xUsername: t.xUsername,
    latitude: t.latitude,
    longitude: t.longitude,
    totalPnl: 0, // Static data doesn't have PnL
    rarityScore: 0,
  }));
  
  return NextResponse.json(traders);
}
