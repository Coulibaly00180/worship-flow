# Context : racine du monorepo (docker build -f apps/web/Dockerfile .)
# ── Stage 1 : dépendances ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache openssl

# Lockfile racine + manifests workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

# Install uniquement le workspace @cp/web (--ignore-scripts, le client Prisma est généré ensuite)
RUN npm ci --workspace=apps/web --ignore-scripts


# ── Stage 2 : build Next.js ──────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Sources du workspace web
COPY apps/web ./apps/web
COPY package.json ./

# Génération du client Prisma 7 (src/generated/prisma, embarqué dans le build Next)
RUN cd apps/web && npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    NEXTAUTH_SECRET="build-secret" \
    NEXTAUTH_URL="http://localhost:3000" \
    AUTH_SECRET="build-secret"

RUN cd apps/web && mkdir -p public && npm run build

# ── Stage 3 : image de production ───────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN apk add --no-cache openssl && \
    npm install -g prisma@7.10.0 && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# outputFileTracingRoot = racine du monorepo → standalone reflète la structure /app/*
# server.js se trouve dans apps/web/, on recopie tout en aplatissant
COPY --from=builder /app/apps/web/public ./public

# Le standalone avec tracingRoot monorepo produit les fichiers dans apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/apps/web/ ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

# Migrations (appliquées au démarrage via entrypoint) + config Prisma 7
COPY --from=builder /app/apps/web/prisma ./prisma
COPY --from=builder /app/apps/web/prisma.config.ts ./prisma.config.ts

COPY apps/web/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
