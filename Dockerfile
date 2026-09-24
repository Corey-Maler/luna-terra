FROM node:22-bookworm-slim AS build
WORKDIR /workspace
RUN npm install --global pnpm@9.12.3
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @lunaterra/demo deploy --prod deploy

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production DEMO_PORT=4200 DEMO_HOST=0.0.0.0 DEMO_DOCS_DIR=/app/public RAYON_NUM_THREADS=2
WORKDIR /app
COPY --from=build --chown=node:node /workspace/deploy/ ./
COPY --from=build --chown=node:node /workspace/dist/apps/docs/ ./public/
USER node
EXPOSE 4200
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.DEMO_PORT + '/readyz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.mjs"]
