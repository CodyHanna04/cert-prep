# syntax=docker/dockerfile:1
# One image serves both deployments: APP_MODE=web (public) and APP_MODE=admin (Tailscale-only).
FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS proddeps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM deps AS build
COPY . .
RUN npm run build

# Migrations and the first-account CLI: `docker compose run --rm migrate` / `... run --rm migrate node scripts/create-user.mjs "Name"`
FROM base AS tools
ENV NODE_ENV=production
COPY --from=proddeps /app/node_modules ./node_modules
COPY package.json ./
COPY lib ./lib
COPY scripts ./scripts
COPY migrations ./migrations
COPY content ./content
CMD ["node", "scripts/migrate.mjs"]

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/content ./content
USER app
EXPOSE 3000
CMD ["node", "server.js"]
