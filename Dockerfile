# Self-hosted build: the same Worker on Node (server/server.mjs). See README "Run off Cloudflare".
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY commands ./commands
COPY public ./public
COPY server ./server
ENV PORT=8787
EXPOSE 8787
USER node
CMD ["node", "--import", "./server/md-text.mjs", "server/server.mjs"]
