# Quick Start: Deploy to Railway

## One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/YOUR_USERNAME/post-sniper)

## Manual Deployment

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Create new project
   railway init
   ```

2. **Add PostgreSQL Database**
   ```bash
   railway add postgresql
   ```

3. **Deploy**
   ```bash
   railway up
   ```

4. **Configure App**
   - Visit your Railway app URL
   - Go to Settings (⚙️)
   - Add Fanpage Karma API token
   - Add monitored Facebook pages

## Environment Variables

Railway will automatically set:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port

You only need to configure:
- Fanpage Karma API token (via app settings UI)

## Features

✅ Server-side background data fetching every 10 minutes  
✅ PostgreSQL database for reliable data storage  
✅ Shared data across all users  
✅ Auto-scaling ready  
✅ Always-on monitoring  

See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed instructions.
