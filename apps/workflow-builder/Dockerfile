FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/job-queue/package.json apps/job-queue/
COPY apps/workflow-builder/package.json apps/workflow-builder/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-ui/package.json packages/shared-ui/
RUN npm install --no-audit --no-fund
COPY apps/job-queue apps/job-queue
COPY apps/workflow-builder apps/workflow-builder
RUN cd apps/job-queue && ../../node_modules/.bin/tsc
RUN cd apps/workflow-builder && ../../node_modules/.bin/tsc

FROM node:20-alpine AS run
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/job-queue/dist ./apps/job-queue/dist
COPY --from=build /repo/apps/job-queue/package.json ./apps/job-queue/package.json
COPY --from=build /repo/apps/workflow-builder/dist ./apps/workflow-builder/dist
COPY --from=build /repo/apps/workflow-builder/package.json ./apps/workflow-builder/package.json
WORKDIR /repo/apps/workflow-builder
EXPOSE 4400
CMD ["node", "dist/bin/server.js"]
