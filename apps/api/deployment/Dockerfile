FROM node:24-alpine AS base

# ---- Prepare Stage ----
FROM base AS prepare

WORKDIR /app
RUN npm install -g turbo

COPY . .
RUN turbo prune api --docker


# ---- Builder Stage ----
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
RUN npm install -g turbo

# Copy lockfile + package.json manifests
COPY --from=prepare /app/out/json/ .

# Copy source code
COPY --from=prepare /app/out/full/ .

# Install all dependencies
RUN CI=true pnpm install --frozen-lockfile

# Build the API app
RUN turbo run build

# ---- Runtime Stage ----
FROM node:24-alpine AS runtime

WORKDIR /app

ENV HUSKY=0

RUN apk add --no-cache postgresql-client curl jq

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY --from=prepare /app/out/json/ .
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

RUN CI=true pnpm install --prod --frozen-lockfile

COPY apps/api/deployment/entrypoint.app.sh /entrypoint.app.sh

RUN chmod +x /entrypoint.app.sh

# Run as the unprivileged user built into the node image
USER node

EXPOSE 3000

ENTRYPOINT ["/entrypoint.app.sh"]
