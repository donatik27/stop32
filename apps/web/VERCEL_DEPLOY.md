# ▲ Vercel Deployment Guide

## Quick Deploy Steps

### 1. Connect to Vercel

**Option A: Vercel CLI**
```bash
npm i -g vercel
vercel login
cd apps/web
vercel --prod
```

**Option B: GitHub Integration (Recommended)**
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### 2. Configure Build Settings

Vercel should auto-detect, but verify:

**Framework Preset:** Next.js
**Root Directory:** `apps/web`
**Build Command:** `pnpm build` (auto-detected)
**Output Directory:** `.next` (auto-detected)

### 3. Add Environment Variables

**Settings → Environment Variables:**
```env
DATABASE_URL=your_neon_connection_string
NODE_ENV=production
```

**⚠️ Important:** ALCHEMY_POLYGON_RPC is NOT needed in frontend (only worker uses it)

### 4. Deploy!

**First Deploy:**
- Click "Deploy"
- Wait 2-3 minutes
- Your site will be live at `your-project.vercel.app`

**Subsequent Deploys:**
- Push to GitHub → Auto-deploy ✅
- Every commit → New deployment
- Every PR → Preview deployment

## Custom Domain (Optional)

**Settings → Domains:**
1. Add your domain (e.g., `smartmoney.bet`)
2. Configure DNS records (Vercel provides instructions)
3. SSL certificate auto-generated ✅

## Performance

**Vercel Edge Network:**
- ✅ Global CDN
- ✅ Automatic caching
- ✅ Instant page loads
- ✅ Same speed as localhost (or faster!)

## Monitoring

**Analytics:** Vercel Dashboard → Analytics
**Logs:** Vercel Dashboard → Logs
**Performance:** Vercel Dashboard → Speed Insights

## Cost

**Hobby Plan (Free):**
- ✅ 100GB bandwidth/month
- ✅ Unlimited deployments
- ✅ Custom domains
- ✅ SSL certificates
- ✅ **Perfect for starting!**

**Pro Plan ($20/month):**
- Only if you need:
  - More bandwidth
  - Team collaboration
  - Advanced analytics

## Troubleshooting

### Build failed?
Check build logs:
```bash
# Common fixes:
pnpm install
pnpm build
# Should complete without errors locally
```

### Database connection failed?
- Verify DATABASE_URL in environment variables
- Check Neon database allows connections
- Add `?sslmode=require` to connection string

### 404 on routes?
- Next.js routes should work automatically
- Check your app router structure in `app/` directory

## Auto-Deploy Setup

**Settings → Git:**
- ✅ Production Branch: `main`
- ✅ Deploy on push: Enabled
- ✅ Preview deployments: Enabled

Now every push to `main` = automatic production deploy! 🚀

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Discord: https://vercel.com/discord
- Vercel Status: https://vercel-status.com
