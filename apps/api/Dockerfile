# Owner: Charan (Section 3, secondary ownership: local Docker Compose bootstrap)
#
# Build context is the repository root, not apps/api, so the same image can
# carry database/seeds/ and serve both the `api` and the `seed` compose
# services without a second build.
FROM node:20-alpine

WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

COPY apps/api/ ./
COPY database/seeds/ ./database/seeds/

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
