export default function HealthPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">System Health</h1>
      
      <div className="grid gap-6">
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Overall Status</span>
              <span className="text-green-500 font-semibold">Healthy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database</span>
              <span className="text-green-500">✓ Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Redis</span>
              <span className="text-green-500">✓ Connected</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Ingestion Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Leaderboard Sync</span>
              <span className="text-sm">Never run</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Markets Sync</span>
              <span className="text-sm">Never run</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Trades Sync</span>
              <span className="text-sm">Never run</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Worker Stats</h2>
          <p className="text-muted-foreground">Worker metrics will appear here when jobs are running.</p>
        </div>
      </div>
    </div>
  )
}

