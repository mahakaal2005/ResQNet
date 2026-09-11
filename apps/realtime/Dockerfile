FROM node:20-slim AS build
WORKDIR /app
COPY apps/realtime/package.json ./
RUN npm install && npm install --no-save typescript@5.5.4
COPY apps/realtime/ ./
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
COPY apps/realtime/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
