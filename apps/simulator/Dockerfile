FROM node:20-slim AS build
WORKDIR /app
COPY apps/simulator/package.json ./
RUN npm install && npm install --no-save typescript@5.5.4
COPY apps/simulator/ ./
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
COPY apps/simulator/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
