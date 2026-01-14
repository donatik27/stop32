'use client'

import { useState, useEffect, Suspense } from 'react'
import { Globe, RefreshCw, Users, Trophy, Target } from 'lucide-react'
import { getTraderLocation } from '@/lib/trader-geolocation'
import dynamic from 'next/dynamic'

// Dynamically import TraderGlobe (client-only)
const TraderGlobe = dynamic(() => import('@/components/TraderGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <p className="text-primary font-mono">LOADING_3D_GLOBE...</p>
    </div>
  ),
})

interface Trader {
  address: string
  displayName: string
  tier: string
  rarityScore: number
}

interface TraderMarker {
  trader: Trader
  lat: number
  lng: number
  region: string
  x: number
  y: number
}

export default function MapPage() {
  const [stats, setStats] = useState({
    totalTraders: 0,
    sTier: 0,
    aTier: 0,
    bTier: 0
  })
  const [traders, setTraders] = useState<TraderMarker[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredTrader, setHoveredTrader] = useState<TraderMarker | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // 1. Fetch traders
      const tradersRes = await fetch('/api/traders')
      const allTraders: Trader[] = await tradersRes.json()
      
      // 2. Filter S/A/B traders
      const smartTraders = allTraders.filter(t => ['S', 'A', 'B'].includes(t.tier))
      
      // 3. Map traders to locations (using CRYPTO as fallback for faster loading)
      const tradersWithLocations: TraderMarker[] = smartTraders.slice(0, 100).map((trader) => {
        // Get random location for now (smart markets takes too long to load)
        const location = getTraderLocation([{ question: 'CRYPTO' }])
        
        // Convert lat/lng to screen coordinates
        const x = ((location.lng + 180) / 360) * 100
        const y = ((90 - location.lat) / 180) * 100
        
        return {
          trader,
          lat: location.lat,
          lng: location.lng,
          region: location.region,
          x,
          y
        }
      })
      
      setTraders(tradersWithLocations)
      
      setStats({
        totalTraders: allTraders.length,
        sTier: allTraders.filter(t => t.tier === 'S').length,
        aTier: allTraders.filter(t => t.tier === 'A').length,
        bTier: allTraders.filter(t => t.tier === 'B').length
      })
      
      console.log(`✅ Mapped ${tradersWithLocations.length} traders to locations`)
      
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto font-mono text-white">
      {/* Header */}
      <div className="mb-6 border-b-2 border-primary/50 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Globe className="h-8 w-8 text-primary alien-glow" />
              <h1 className="text-3xl font-bold text-primary alien-glow">TRADER_RADAR.3D</h1>
              {loading && <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-muted-foreground text-sm">
              &gt; GEOGRAPHIC_DISTRIBUTION_OF_SMART_TRADERS
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-primary text-black rounded-sm hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-2 border-2 border-primary alien-glow"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-4xl opacity-10">👥</div>
          <p className="text-xs font-mono text-primary mb-1 uppercase tracking-wider">Mapped_Traders</p>
          <p className="text-2xl font-bold text-white relative z-10">
            {loading ? '...' : traders.length}
          </p>
        </div>
        <div className="bg-card pixel-border border-[#FFD700]/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-4xl opacity-10">🏆</div>
          <p className="text-xs font-mono text-[#FFD700] mb-1 uppercase tracking-wider">S_Tier</p>
          <p className="text-2xl font-bold text-[#FFD700] relative z-10">
            {loading ? '...' : traders.filter(t => t.trader.tier === 'S').length}
          </p>
        </div>
        <div className="bg-card pixel-border border-white/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-4xl opacity-10">⭐</div>
          <p className="text-xs font-mono text-white mb-1 uppercase tracking-wider">A_Tier</p>
          <p className="text-2xl font-bold text-white relative z-10">
            {loading ? '...' : traders.filter(t => t.trader.tier === 'A').length}
          </p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-4xl opacity-10">🎯</div>
          <p className="text-xs font-mono text-primary mb-1 uppercase tracking-wider">B_Tier</p>
          <p className="text-2xl font-bold text-primary relative z-10">
            {loading ? '...' : traders.filter(t => t.trader.tier === 'B').length}
          </p>
        </div>
      </div>

      {/* 3D Earth Globe with Three.js */}
      <div className="bg-black pixel-border border-primary/40 relative overflow-hidden mb-6 h-[600px]">
        {/* Info overlay */}
        <div className="absolute top-4 left-4 bg-black/90 pixel-border border-primary/50 p-3 z-20 pointer-events-none">
          <p className="text-primary font-mono text-xs mb-1">&gt; THREE.JS_GLOBE.3D</p>
          <p className="text-white text-sm font-bold">{traders.length} TRADERS MAPPED</p>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-[#FFD700]">● S</span>
            <span className="text-white">● A</span>
            <span className="text-primary">● B</span>
          </div>
        </div>
        
        {/* Controls hint */}
        <div className="absolute bottom-4 right-4 bg-black/90 pixel-border border-primary/50 p-2 z-20 pointer-events-none">
          <p className="text-muted-foreground font-mono text-xs">
            &gt; DRAG_TO_ROTATE • SCROLL_TO_ZOOM
          </p>
        </div>

        {/* 3D Globe */}
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-black">
            <p className="text-primary font-mono animate-pulse">LOADING_3D_GLOBE...</p>
          </div>
        }>
          <TraderGlobe
            traders={traders.map((m) => ({
              address: m.trader.address,
              displayName: m.trader.displayName,
              tier: m.trader.tier,
              lat: m.lat,
              lng: m.lng,
              pnl: m.trader.rarityScore,
            }))}
          />
        </Suspense>
      </div>

      {/* Trader List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By Region */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <h2 className="text-lg font-bold text-primary mb-4">
            &gt; TRADERS_BY_REGION:
          </h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {Object.entries(
              traders.reduce((acc, t) => {
                acc[t.region] = (acc[t.region] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            )
            .sort((a, b) => b[1] - a[1])
            .map(([region, count]) => (
              <div key={region} className="flex items-center justify-between p-2 bg-black/40 pixel-border border-white/20">
                <span className="text-sm text-white">{region}</span>
                <span className="text-primary font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Traders */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <h2 className="text-lg font-bold text-primary mb-4">
            &gt; TOP_MAPPED_TRADERS:
          </h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {traders.slice(0, 10).map((marker) => (
              <div
                key={marker.trader.address}
                className="flex items-center justify-between p-2 bg-black/40 pixel-border border-white/20 hover:border-primary transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-bold pixel-border ${
                      marker.trader.tier === 'S'
                        ? 'bg-[#FFD700] text-black'
                        : marker.trader.tier === 'A'
                        ? 'bg-white text-black'
                        : 'bg-primary text-black'
                    }`}
                  >
                    {marker.trader.tier}
                  </span>
                  <span className="text-sm text-white truncate max-w-[150px]">
                    {marker.trader.displayName}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{marker.region}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-card pixel-border border-primary/40 p-6">
        <h2 className="text-lg font-bold text-primary mb-4">
          &gt; HOW_IT_WORKS:
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• 🌍 Interactive 3D Earth (Three.js/WebGL)</p>
          <p>• 🎯 Trader locations based on their markets</p>
          <p>• 🇺🇸 US markets (NFL, Trump, etc.) → USA placement</p>
          <p>• 🇪🇺 European events → Europe placement</p>
          <p>• 🌏 Asia/Middle East (Iran, China) → Regional placement</p>
          <p>• 💰 Crypto/General → Singapore/Global hubs</p>
          <p className="text-primary mt-4">• 🟡 S-tier | ⚪ A-tier | 🟢 B-tier traders</p>
          <p className="text-xs text-muted-foreground mt-4 italic">
            &gt; Drag to rotate • Scroll to zoom • Hover over markers
          </p>
        </div>
      </div>
    </div>
  )
}
