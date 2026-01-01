# Multi-stage build for optimized image size
FROM node:20-slim AS base

# Install Sharp dependencies
RUN apt-get update && apt-get install -y \
    python3 make g++ libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and shared types for base
COPY services/worker/package*.json ./
COPY services/shared ../shared/
COPY services/worker/src ./src
COPY services/worker/tsconfig.json ./
RUN npm install

# Dependencies stage
FROM base AS dependencies
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
COPY services/worker/package*.json ./
COPY services/shared ../shared/
RUN npm ci
COPY services/worker/src ./src
COPY services/worker/tsconfig.json ./
RUN npm run build

# Production stage
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY services/worker/package*.json ./

# Security: non-root user
RUN useradd -m -u 1001 worker && chown -R worker:worker /app
USER worker

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 3001

CMD ["node", "dist/index.js"]
