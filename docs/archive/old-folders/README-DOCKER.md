# Running Coach - Docker Worker Setup

## Overview

This Docker setup provides a **local development environment** for testing background workers and AI pipelines. Production stays on Vercel's free tier until you need to scale.

## Prerequisites

- Docker & Docker Compose installed
- Node.js 20+
- OpenAI API key

## Quick Start

### 1. Set Up Environment Variables

Copy the example file and add your OpenAI API key:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your `OPENAI_API_KEY`.

### 2. Install Worker Dependencies

```bash
cd services/worker
npm install
cd ../..
```

### 3. Start Docker Services

```bash
docker-compose up
```

This will start:
- **Redis** on port 6379
- **Worker** on port 3001 (health check endpoint)

### 4. Test the Setup

In another terminal, check the health endpoint:

```bash
curl http://localhost:3001/health
```

You should see:
```json
{"status":"healthy","workers":[{"name":"ai-activity","running":true}]}
```

### 5. View Logs

```bash
# All services
docker-compose logs -f

# Worker only
docker-compose logs -f worker

# Redis only
docker-compose logs -f redis
```

### 6. Stop Services

```bash
docker-compose down
```

## Architecture

### Local Development (Docker)
```
┌─────────────────────────────────────┐
│  Your Browser (localhost:3000)     │
│  ↓                                  │
│  Next.js Dev Server (v0/)          │
│  • Enqueues jobs to Redis          │
│  • Polls for results               │
└──────────────┬──────────────────────┘
               │
     ┌─────────┴─────────┐
     ↓                   ↓
┌────────────┐   ┌──────────────────┐
│ Redis      │   │  Worker          │
│ Port 6379  │←──│  Port 3001       │
└────────────┘   └──────────────────┘
```

### Production (Current - Vercel Free Tier)
```
┌─────────────────────────────────────┐
│  User Browser                       │
│  ↓                                  │
│  Next.js on Vercel                 │
│  • API routes (synchronous)        │
│  • 60s timeout limit               │
│  • FREE TIER - $0/month            │
└─────────────────────────────────────┘
```

## When to Use Docker vs Serverless

### Use Docker Worker Locally For:
- Testing heavy AI operations without hitting Vercel timeout limits
- Debugging image processing with Sharp
- Developing new AI features that might exceed 60s
- Load testing without burning through Vercel function invocations

### Keep Vercel Serverless (Current Production) For:
- MVP/Early Users - Free tier handles low traffic perfectly
- Simple operations under 10-20 seconds
- Avoiding infrastructure complexity when building features
- Zero cost until you have traction

### Migrate to Deployed Worker When:
- Consistent timeouts - Users regularly hit 60s limit
- High volume - 1000+ AI operations per day
- Background processing needed - Batch jobs, scheduled tasks
- Cost optimization - Worker becomes cheaper than Vercel functions at scale

## Development Workflow

### Working on Worker Code

The worker uses hot reload via `tsx watch`, so changes to `services/worker/src/**` will automatically restart the worker.

```bash
# Make changes to services/worker/src/jobs/ai-activity.ts
# Worker automatically restarts
# Check logs: docker-compose logs -f worker
```

### Adding New Job Types

1. Add job type to `services/shared/types/jobs.ts`
2. Create handler in `services/worker/src/jobs/your-job.ts`
3. Register worker in `services/worker/src/processors/main.ts`
4. Restart worker: `docker-compose restart worker`

### Debugging

```bash
# Enter worker container
docker-compose exec worker sh

# Check Redis connection
docker-compose exec redis redis-cli ping

# View worker environment
docker-compose exec worker env

# Rebuild worker after package.json changes
docker-compose build worker
docker-compose up worker
```

## Troubleshooting

### Worker Fails to Start

**Symptom**: Worker container exits immediately

**Solution**:
```bash
# Check logs
docker-compose logs worker

# Common issues:
# 1. Missing dependencies - run: cd services/worker && npm install
# 2. Syntax error - check worker logs
# 3. Redis not ready - wait for Redis healthcheck
```

### Redis Connection Failed

**Symptom**: Worker logs show "Redis connection failed"

**Solution**:
```bash
# Check Redis is running
docker-compose ps

# Restart Redis
docker-compose restart redis

# Check Redis logs
docker-compose logs redis
```

### TypeScript Errors

**Symptom**: Worker shows TypeScript compilation errors

**Solution**:
```bash
# Rebuild TypeScript
cd services/worker
npm run build

# Or use dev mode (auto-compile)
docker-compose up worker
```

## Production Deployment (Future)

When ready to deploy the worker to production:

### Option A: Railway ($5/month, free first month with credit)
```bash
railway login
railway init
railway up
```

### Option B: Fly.io (Free tier)
```bash
flyctl auth login
flyctl launch
flyctl deploy
```

See the main plan document for detailed deployment instructions.

## File Structure

```
Running-coach--2/
├── services/
│   ├── worker/
│   │   ├── src/
│   │   │   ├── jobs/           # Job handlers
│   │   │   ├── processors/     # BullMQ workers
│   │   │   ├── utils/          # Utilities
│   │   │   ├── health.ts       # Health check
│   │   │   └── index.ts        # Entry point
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/
│       └── types/
│           └── jobs.ts         # Shared types
├── docker-compose.yml
├── .dockerignore
└── .env.example
```

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

### Queue Status (via Redis CLI)

```bash
docker-compose exec redis redis-cli

# Check queue length
LLEN bull:ai-activity:wait

# Check active jobs
LLEN bull:ai-activity:active

# Check failed jobs
LLEN bull:ai-activity:failed
```

## Cost Estimate

**Current Setup (Local Only)**:
- Local Development: $0/month
- Vercel Production: $0/month
- **Total: $0/month**

**Future Deployment**:
- Upstash Redis: $0/month (free tier)
- Railway Worker: $5/month (free first month)
- Fly.io Worker: $0/month (free tier)
- **Total when deployed: $0-5/month**

## Next Steps

1. ✅ Docker setup complete
2. 📝 Optionally integrate with Vercel (see plan for queue client)
3. 🚀 Deploy to Railway/Fly.io when ready to scale
4. 📊 Add monitoring (Sentry, PostHog, etc.)

## Support

- Check main plan document for detailed architecture
- See [CLAUDE.md](./CLAUDE.md) for project guidelines
- Report issues via GitHub
