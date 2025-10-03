# Production Deployment Debug Guide

## Issue
Production returns HTML instead of JSON for `/api/goals/habits/optimize/analyze`
Error: `SyntaxError: Unexpected token 'T', "The page c"... is not valid JSON`

## Root Cause
The new optimization routes aren't deployed to production. Git push doesn't auto-trigger rebuild.

## Fix Steps

### Option 1: Manual Deployment (Replit/Railway)
If you're on Replit or Railway, you need to manually trigger deployment:

**Replit:**
1. Go to your Replit dashboard
2. Navigate to the Deployments tab
3. Click "Deploy" button to trigger new deployment
4. Wait for build to complete

**Railway:**
1. Git push triggers auto-deploy
2. Check deployment logs in Railway dashboard
3. Verify new deployment is running

### Option 2: Manual Build (If SSH access)
```bash
cd /path/to/intention-growth-hub
git pull origin main
npm install
npm run build
pm2 restart app  # or however you restart the server
```

### Option 3: Vercel/Netlify (Serverless)
If using Vercel/Netlify:
```bash
# Trigger new deployment
vercel --prod
# or
netlify deploy --prod
```

## Verification

After deployment, test the endpoint:
```bash
# Replace YOUR_PRODUCTION_URL with actual URL
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://YOUR_PRODUCTION_URL/api/goals/habits/optimize/analyze
```

Should return JSON like:
```json
{
  "habitsToArchive": [...],
  "habitsToCreate": [...],
  "summary": {...}
}
```

NOT HTML like:
```html
<!DOCTYPE html>
<html>...
```

## Check Build Output

The build should include these new files:
- `server/ai/habitOptimizationAgent.ts`
- `server/services/habitOptimizationService.ts`
- Routes in `server/routes/goals.ts` with `/habits/optimize/*`

Build command: `npm run build`
- Runs: `vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
- Output: `dist/index.js` (bundled server)
- Client: `dist/` (Vite build)

## Common Issues

### 1. Build Cache
Clear build cache:
```bash
rm -rf dist/
rm -rf client/dist/
npm run build
```

### 2. Environment Variables
Ensure production has:
- `NODE_ENV=production`
- `OPENAI_API_KEY` (for optimization agent)
- Database connection string

### 3. Port/Host Issues
Production should listen on:
- `0.0.0.0` (not localhost)
- Port from `process.env.PORT` or 3000

## Quick Fix Commands

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies (in case of new packages)
npm install

# 3. Build for production
npm run build

# 4. Restart server (adjust based on your setup)
# For PM2:
pm2 restart intention-growth-hub

# For systemd:
sudo systemctl restart intention-growth-hub

# For Docker:
docker-compose down && docker-compose up -d --build

# For Replit:
# Just click "Deploy" in dashboard
```

## Test Locally First

Before deploying, test production build locally:
```bash
npm run build
NODE_ENV=production npm start
# Then test: http://localhost:3000/api/goals/habits/optimize/analyze
```

