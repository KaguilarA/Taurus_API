FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node restaurant ./restaurant
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 LOCAL_MONGO_AUTOSTART=false TRUST_PROXY=1
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["node", "restaurant/healthcheck.js"]
CMD ["node", "restaurant/server.js"]
