FROM node:20-slim AS build

WORKDIR /repo
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/realtime/package.json ./apps/realtime/package.json

WORKDIR /repo/apps/realtime
RUN npm install && npm install --no-save typescript@5.5.4

WORKDIR /repo
COPY apps/realtime/ ./apps/realtime/

WORKDIR /repo/apps/realtime
RUN npm run build

FROM node:20-slim AS runtime

WORKDIR /app
COPY apps/realtime/package.json ./package.json
RUN npm install --omit=dev
COPY --from=build /repo/apps/realtime/dist ./dist

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
