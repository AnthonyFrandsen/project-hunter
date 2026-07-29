# Build context is the repo root (see docker-compose.yml) — the server package
# depends on `shared` via an npm workspace symlink, so the whole workspace is
# needed to install and build it.
FROM node:22.16.0-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY extension/package.json extension/

RUN npm ci

COPY tsconfig.base.json ./
COPY shared shared
COPY server server

RUN npm run build --workspace=server

WORKDIR /app/server

EXPOSE 10105

CMD ["node", "dist/index.js"]
