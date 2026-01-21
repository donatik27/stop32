'use client'

import { useEffect, useRef, useState } from 'react'

interface HeartbeatMonitorProps {
  bpm?: number // Beats per minute (use volume/1M as BPM)
  label?: string
  color?: string
}

export default function HeartbeatMonitor({ 
  bpm = 75, 
  label = 'SYSTEM PULSE',
  color = '#00ff00'
}: HeartbeatMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [heartbeat, setHeartbeat] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const width = canvas.width
    const height = canvas.height

    // ECG wave data (realistic heartbeat pattern)
    const ecgWave = [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Baseline
      0, 0, 0, 0, 0.1, 0.2, 0.1, 0, 0, 0, // P wave (small bump)
      0, 0, 0, 0, 0, 0, 0, 0, // Flat
      -0.2, -0.3, 1.5, -0.5, 0, 0, 0, // QRS complex (big spike!)
      0, 0, 0, 0, 0, 0, 0, // Flat
      0, 0.15, 0.3, 0.25, 0.15, 0, 0, 0, // T wave (medium bump)
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Long baseline
    ]

    let offset = 0
    const speed = bpm / 60 // Convert BPM to speed multiplier

    function drawECG() {
      if (!ctx || !canvas) return

      // Clear with fade effect (trail)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, width, height)

      // Draw grid (like real monitor)
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)'
      ctx.lineWidth = 1
      
      // Vertical lines
      for (let x = 0; x < width; x += 20) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      
      // Horizontal lines
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Draw ECG wave
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.shadowBlur = 10
      ctx.shadowColor = color
      ctx.beginPath()

      const centerY = height / 2
      const scale = height * 0.3

      for (let x = 0; x < width; x++) {
        const waveIndex = Math.floor((x + offset) / 4) % ecgWave.length
        const y = centerY - ecgWave[waveIndex] * scale
        
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()
      ctx.shadowBlur = 0

      // Move wave
      offset += speed * 2
      if (offset > ecgWave.length * 4) {
        offset = 0
        setHeartbeat(prev => prev + 1) // Trigger heartbeat flash
      }
    }

    const interval = setInterval(drawECG, 1000 / 60) // 60 FPS

    return () => clearInterval(interval)
  }, [bpm, color])

  // Flash effect on heartbeat
  useEffect(() => {
    const timer = setTimeout(() => setHeartbeat(0), 100)
    return () => clearTimeout(timer)
  }, [heartbeat])

  return (
    <div className="relative bg-black border-2 border-primary/30 rounded-sm overflow-hidden">
      {/* Label */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <div 
          className={`w-2 h-2 rounded-full transition-all duration-100 ${
            heartbeat > 0 ? 'bg-primary scale-150 shadow-lg shadow-primary' : 'bg-primary/50'
          }`}
        />
        <span className="text-primary font-mono text-xs tracking-wider">{label}</span>
      </div>

      {/* BPM Display */}
      <div className="absolute top-2 right-2 z-10 bg-black/80 px-2 py-1 rounded border border-primary/30">
        <div className="text-primary font-mono text-lg font-bold tabular-nums">
          {Math.round(bpm)}
        </div>
        <div className="text-primary/50 font-mono text-[10px] text-center">BPM</div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={600}
        height={150}
        className="w-full h-[150px]"
        style={{ imageRendering: 'crisp-edges' }}
      />

      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-primary/5 to-transparent animate-pulse" />
    </div>
  )
}
