# 🚂 Railway Deployment Guide

## Quick Deploy Steps

### 1. Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 2. Configure Worker Service

**Settings → Service Settings:**
- **Root Directory:** `apps/worker`
- **Start Command:** (Railway will auto-detect from package.json)

### 3. Add Environment Variables

**Settings → Variables:**
```env
DATABASE_URL=your_neon_connection_string
ALCHEMY_POLYGON_RPC=your_alchemy_key
NODE_ENV=production
```

### 4. Deploy!

Railway will automatically:
- ✅ Install dependencies (pnpm)
- ✅ Build TypeScript code
- ✅ Generate Prisma client
- ✅ Start the worker
- ✅ Keep it running 24/7

## Monitoring

**Logs:** Railway Dashboard → Your Service → Logs
**Metrics:** Railway Dashboard → Your Service → Metrics
**Alerts:** Railway Dashboard → Settings → Alerts

## Cost Estimate

**Typical Usage:**
- 512MB RAM
- Running 24/7
- **~$3-5/month**

**Startup Program:**
- Apply at railway.app/startups
- Get up to $100/month free credits!

## Troubleshooting

### Worker not starting?
Check logs for error messages:
```bash
# In Railway dashboard
Logs → Filter by "error"
```

### Database connection failed?
Verify DATABASE_URL in environment variables:
- Should include `?sslmode=require`
- Check Neon database is accessible

### Prisma errors?
Railway should auto-generate Prisma client, but if needed:
```bash
# Add to start command:
pnpm prisma generate && pnpm start
```

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app
