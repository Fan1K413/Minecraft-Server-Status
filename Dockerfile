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

FROM dependencies AS web
COPY . .
WORKDIR /app/apps/web
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]

FROM dependencies AS monitor
COPY . .
WORKDIR /app/apps/monitor
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
