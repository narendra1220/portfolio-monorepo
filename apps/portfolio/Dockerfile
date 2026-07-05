FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/portfolio/package.json apps/portfolio/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-ui/package.json packages/shared-ui/
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm install -w @portfolio/portfolio --no-audit --no-fund \
 && cd apps/portfolio \
 && ./node_modules/.bin/next build || npx --no-install next build

FROM node:20-alpine AS run
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/apps/portfolio/.next ./apps/portfolio/.next
COPY --from=build /repo/apps/portfolio/public ./apps/portfolio/public
COPY --from=build /repo/apps/portfolio/package.json ./apps/portfolio/package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
WORKDIR /repo/apps/portfolio
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
