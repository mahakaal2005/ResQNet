FROM node:20-slim AS build

WORKDIR /repo
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/simulator/package.json ./apps/simulator/package.json

WORKDIR /repo/apps/simulator
RUN npm install && npm install --no-save typescript@5.5.4

WORKDIR /repo
COPY apps/simulator/ ./apps/simulator/

WORKDIR /repo/apps/simulator
RUN npm run build

FROM node:20-slim AS runtime

WORKDIR /app
COPY apps/simulator/package.json ./package.json
RUN npm install --omit=dev
COPY --from=build /repo/apps/simulator/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
