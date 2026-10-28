FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY frontend/package*.json frontend/
RUN npm ci --prefix frontend
COPY backend/package*.json backend/
RUN npm ci --prefix backend
COPY frontend frontend
COPY backend backend
RUN npm --prefix backend run db:generate && npm --prefix backend run build && npm --prefix frontend run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
# Patch npm's own bundled libraries until the upstream image includes these fixes.
# App lockfiles do not govern this global tooling tree; keep the image scan enabled.
RUN npm ci --omit=dev \
    && npm install --prefix /tmp/npm-security-patches --no-save --omit=dev --ignore-scripts --package-lock=false undici@6.29.1 brace-expansion@5.0.12 \
    && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/balanced-match \
    && cp -a /tmp/npm-security-patches/node_modules/undici /tmp/npm-security-patches/node_modules/brace-expansion /tmp/npm-security-patches/node_modules/balanced-match /usr/local/lib/node_modules/npm/node_modules/ \
    && rm -rf /tmp/npm-security-patches \
    && npm cache clean --force
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/content ./content
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/frontend/dist /app/frontend/dist
COPY --chmod=755 backend/scripts/start-container.sh ./scripts/start-container.sh
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/src/server.js"]
