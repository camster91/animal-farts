# Animal Farts — production Dockerfile
# Single-process Node server serves both the static SPA and the /api/* endpoints.
# Build happens in two stages: client (Vite) → server (Express + better-sqlite3).

# ─── Stage 1: build the client (Vite SPA) ──────────────────────────────────
FROM node:20-alpine AS client

WORKDIR /app

# Copy only the package files first for cache-friendly install
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy the source and build
COPY . .
RUN npm run build

# ─── Stage 2: runtime server ────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Server-only deps (Express, sqlite, multer, cors)
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund && cd ..

# Copy the built client + server source from the previous stage
COPY --from=client /app/dist ./dist
COPY server ./server

# Persistent volume location — DB + uploaded recordings
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV PORT=3000 \
    NODE_ENV=production \
    DB_PATH=/app/data/farts.db \
    UPLOAD_DIR=/app/data/uploads

EXPOSE 3000

# In-container healthcheck (separate from Coolify's proxy check)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/api/health || exit 1

WORKDIR /app/server
CMD ["node", "server.js"]
