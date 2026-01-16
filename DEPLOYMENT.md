# 🚀 Production Deployment Guide

Complete guide to deploy your Polymarket Smart Money tracker to production.

## Architecture Overview

```
┌─────────────────────────────────────┐
│ VERCEL (Frontend)                   │
│ - Next.js app                       │
│ - API routes                        │
│ - Static pages                      │
│ URL: your-project.vercel.app        │
└─────────────────────────────────────┘
           │
           │ reads data
           ↓
┌─────────────────────────────────────┐
│ NEON (Database)                     │
│ - PostgreSQL                        │
│ - Serverless                        │
│ - Auto-scaling                      │
└─────────────────────────────────────┘
           ↑
           │ writes data
┌─────────────────────────────────────┐
│ RAILWAY (Worker)                    │
│ - Background jobs                   │
│ - Blockchain analysis               │
│ - Data updates (24/7)               │
└─────────────────────────────────────┘
```

## 📋 Deployment Checklist

### ✅ Prerequisites
- [ ] GitHub repository created
- [ ] Code pushed to `main` branch
- [ ] All local tests passing
- [ ] Environment variables ready

### ✅ Step 1: Database (Neon)

**Time:** 5 minutes  
**Cost:** Free

1. Go to [neon.tech](https://neon.tech)
2. Sign up / Log in
3. Create new project: "polymarket-smart-money"
4. Copy connection string
5. Run migrations:
   ```bash
   cd apps/worker
   DATABASE_URL="your_neon_url" pnpm prisma migrate deploy
   ```

**✓ Verify:** Connection string looks like:
```
postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
```

### ✅ Step 2: Worker (Railway)

**Time:** 10 minutes  
**Cost:** ~$5/month

1. Go to [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Select your repository
4. Configure:
   - Root Directory: `apps/worker`
   - Railway will auto-detect Node.js
5. Add environment variables:
   ```env
   DATABASE_URL=your_neon_connection_string
   ALCHEMY_POLYGON_RPC=your_alchemy_key
   NODE_ENV=production
   ```
6. Deploy!

**✓ Verify:** Check logs for:
```
🚀 Starting Polymarket Worker...
✅ Workers started
✅ Jobs scheduled
🎉 Worker is running
```

**📖 Detailed guide:** [apps/worker/RAILWAY_DEPLOY.md](apps/worker/RAILWAY_DEPLOY.md)

### ✅ Step 3: Frontend (Vercel)

**Time:** 5 minutes  
**Cost:** Free

1. Go to [vercel.com](https://vercel.com)
2. "Add New Project"
3. Import GitHub repository
4. Configure:
   - Framework: Next.js (auto-detected)
   - Root Directory: `apps/web`
5. Add environment variables:
   ```env
   DATABASE_URL=your_neon_connection_string
   NODE_ENV=production
   ```
6. Deploy!

**✓ Verify:** Open your-project.vercel.app and check:
- [ ] Homepage loads
- [ ] `/markets` page shows data
- [ ] `/traders` page shows data
- [ ] `/map` page renders globe

**📖 Detailed guide:** [apps/web/VERCEL_DEPLOY.md](apps/web/VERCEL_DEPLOY.md)

### ✅ Step 4: Post-Deploy Verification

1. **Check Worker is running:**
   ```bash
   # Railway Dashboard → Your Service → Logs
   # Should see continuous activity
   ```

2. **Check data is updating:**
   ```bash
   # Open your Vercel site
   # Wait 5-10 minutes
   # Refresh - data should update
   ```

3. **Check all pages work:**
   - [ ] `/` - Homepage ✓
   - [ ] `/markets` - Hot Markets ✓
   - [ ] `/markets/smart` - Alpha Markets ✓
   - [ ] `/markets/smart/[id]` - Market details ✓
   - [ ] `/traders` - Traders list ✓
   - [ ] `/traders/[address]` - Trader profile ✓
   - [ ] `/map` - Trader map ✓

## 💰 Total Cost Breakdown

| Service | Plan | Cost |
|---------|------|------|
| **Vercel** | Hobby | **$0/month** |
| **Neon** | Free Tier | **$0/month** |
| **Railway** | Pay-as-you-go | **~$5/month** |
| **TOTAL** | | **$5/month** |

**💡 Pro tip:** Apply for Railway Startup Program for $100/month free credits!  
👉 [railway.app/startups](https://railway.app/startups)

## 🔧 Maintenance

### Auto-Deploy Setup

**Vercel:**
- Push to `main` → Auto-deploy ✅
- Every PR → Preview deployment ✅

**Railway:**
- Push to `main` → Worker auto-redeploys ✅
- Zero downtime deployments ✅

### Monitoring

**Vercel Analytics:**
- Dashboard → Analytics
- Track page views, performance

**Railway Metrics:**
- Dashboard → Metrics
- CPU, RAM, Network usage

**Database (Neon):**
- Dashboard → Monitoring
- Query performance, connections

### Logs

**Frontend logs:** Vercel Dashboard → Logs  
**Worker logs:** Railway Dashboard → Logs  
**Database logs:** Neon Dashboard → Monitoring

## 🆘 Troubleshooting

### "Worker not updating data"
1. Check Railway logs for errors
2. Verify DATABASE_URL is correct
3. Check Alchemy RPC key is valid

### "Frontend slow"
1. Check Vercel Analytics
2. Verify database region matches Vercel region (US East recommended)
3. Consider adding caching

### "Database connection errors"
1. Verify connection string has `?sslmode=require`
2. Check Neon database is not paused (free tier)
3. Restart Railway worker

## 🎯 Next Steps

After successful deployment:

1. **Set up custom domain** (optional)
   - Vercel Dashboard → Domains
   - Add your domain (e.g., `smartmoney.bet`)

2. **Enable auto-scaling** (if needed)
   - Railway: Settings → Autoscaling
   - Neon: Automatic on paid tiers

3. **Set up monitoring alerts**
   - Railway: Settings → Alerts
   - Email/Slack notifications

4. **Backup strategy**
   - Neon: Enable point-in-time recovery
   - Database exports weekly

## 📞 Support

**Railway:**
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

**Vercel:**
- Docs: https://vercel.com/docs
- Discord: https://vercel.com/discord

**Neon:**
- Docs: https://neon.tech/docs
- Discord: https://discord.gg/neon

---

## ✨ You're All Set!

Your Polymarket Smart Money tracker is now running in production! 🎉

**Share your site and start tracking smart money!** 🚀
