FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node api ./api
COPY --chown=node:node config ./config
COPY --chown=node:node controllers ./controllers
COPY --chown=node:node db ./db
COPY --chown=node:node middlewares ./middlewares
COPY --chown=node:node models ./models
COPY --chown=node:node routes ./routes
COPY --chown=node:node services ./services
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node app.js index.js ./
COPY --chown=node:node web ./web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 FRONTEND_DIST=./web LOCAL_MONGO_AUTOSTART=false TRUST_PROXY=1
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["node", "scripts/healthcheck.js"]
CMD ["node", "index.js"]
