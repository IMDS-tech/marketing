FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY . .
RUN pnpm install --no-frozen-lockfile --ignore-scripts && pnpm --filter @imds/notification-worker build
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@imds/notification-worker", "start"]
