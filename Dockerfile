FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/monitor/package.json apps/monitor/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile=false
COPY . .

FROM base AS web
RUN pnpm --filter web build
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]

FROM base AS monitor
CMD ["pnpm", "--filter", "monitor", "dev"]
