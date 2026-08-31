# ============================================================
# Plugio Admin — Multi-stage Dockerfile
# Build:   docker build -t plugio-admin .
# Runtime: node:20-alpine (non-root, standalone output)
# ============================================================

# ── Stage 1: Dependency install ──────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc compatibility shim required by some native addons (e.g. sharp).
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# ── Stage 2: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Disable Next.js anonymous telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_ENVIRONMENT
ENV NEXT_PUBLIC_ENVIRONMENT=$NEXT_PUBLIC_ENVIRONMENT

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next build produces a standalone output bundle (configured in next.config.ts).
RUN npm run build

# ── Stage 3: Production runtime ──────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install curl for the HEALTHCHECK probe.
RUN apk add --no-cache curl

# Create a dedicated non-root user/group.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Pre-create the .next directory with correct ownership.
RUN mkdir -p .next && chown nextjs:nodejs .next

# Copy the standalone server bundle and static assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# Drop privileges before the process starts.
USER nextjs

# Declare the port the application listens on.
EXPOSE 3000

ENV PORT=3000
# Bind to all interfaces so the container is reachable from the host.
ENV HOSTNAME="0.0.0.0"

# ── Health check ─────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# ── Entrypoint ───────────────────────────────────────────────
CMD ["node", "server.js"]
