FROM node:24-alpine AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/monitor/package.json apps/monitor/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
RUN apk add --no-cache python3 make g++ && pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
RUN pnpm --filter web build && pnpm --filter monitor build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app /app
RUN chown -R app:app /app
USER app

FROM runtime AS web
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]

FROM runtime AS monitor
WORKDIR /app/apps/monitor
CMD ["node_modules/.bin/tsx", "src/index.ts"]
