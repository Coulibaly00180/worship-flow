# Context : racine du monorepo (docker build -f apps/web/Dockerfile .)
# ── Stage 1 : dépendances ────────────────────────────────────────────────────
FROM node:26-alpine AS deps
WORKDIR /app

RUN for i in 1 2 3 4 5; do apk add --no-cache openssl && break || { echo "apk: nouvel essai ($i)"; sleep 5; }; done; apk info -e openssl

# Lockfile racine + manifests workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

# Install uniquement le workspace @cp/web (--ignore-scripts, le client Prisma est généré ensuite)
RUN npm ci --workspace=apps/web --ignore-scripts


# ── Stage 2 : build Next.js ──────────────────────────────────────────────────
FROM node:26-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

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
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN for i in 1 2 3 4 5; do apk add --no-cache openssl && break || { echo "apk: nouvel essai ($i)"; sleep 5; }; done; apk info -e openssl && \
    npm install -g prisma@7.10.1 && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# outputFileTracingRoot = racine du monorepo → standalone reflète la structure /app/*
# server.js se trouve dans apps/web/, on recopie tout en aplatissant
COPY --from=builder /app/apps/web/public ./public

# Le standalone avec tracingRoot monorepo produit les fichiers dans apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/apps/web/ ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

# Turbopack crée des liens .next/node_modules/<pkg>-<hash> -> ../../../../../node_modules/<pkg>
# valides dans le monorepo mais cassés dans cette image aplatie : on les repointe vers /app/node_modules.
RUN find .next/node_modules -type l 2>/dev/null | while read -r l; do \
      pkg=$(readlink "$l" | sed 's#.*/node_modules/##'); \
      ln -sfn "/app/node_modules/$pkg" "$l"; \
    done

# Migrations (appliquées au démarrage via entrypoint) + config Prisma 7
COPY --from=builder /app/apps/web/prisma ./prisma
COPY --from=builder /app/apps/web/prisma.config.ts ./prisma.config.ts

COPY apps/web/docker-entrypoint.sh ./
RUN tr -d '\r' < docker-entrypoint.sh > entrypoint.tmp && mv entrypoint.tmp docker-entrypoint.sh && chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
