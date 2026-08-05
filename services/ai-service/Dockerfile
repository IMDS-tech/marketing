FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY . .
RUN pnpm install --no-frozen-lockfile --ignore-scripts && pnpm --filter @imds/ai-service build
ENV NODE_ENV=production
EXPOSE 4304
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD node -e "fetch('http://127.0.0.1:4304/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "--filter", "@imds/ai-service", "start"]
