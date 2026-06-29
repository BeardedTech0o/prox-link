# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ── dependencies (incl. dev, needed for the build) ───────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# ── build the Next.js app ────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npm run build

# ── runtime image (non-root) ─────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    PROXLINK_DATA_DIR=/data
RUN useradd -m -u 10001 proxlink && mkdir -p /data && chown proxlink:proxlink /data

# tsx runs the TypeScript custom server at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/lib ./lib
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/package.json ./package.json

USER proxlink
EXPOSE 3000
VOLUME ["/data"]
CMD ["npx", "tsx", "server.ts"]
