FROM node:24-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app/frontend
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ARG BORZA_STRICT_PUBLIC_ENV=true
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    BORZA_STRICT_PUBLIC_ENV=$BORZA_STRICT_PUBLIC_ENV \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY frontend .
COPY content /app/content
RUN test -n "$NEXT_PUBLIC_API_URL" \
    || (echo "NEXT_PUBLIC_API_URL build argument is required" >&2; exit 1)
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app/frontend
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 10001 borza \
    && adduser --system --uid 10001 --ingroup borza borza

COPY --from=build --chown=borza:borza /app/frontend/.next/standalone /app
COPY --from=build --chown=borza:borza /app/frontend/public ./public
COPY --from=build --chown=borza:borza /app/frontend/.next/static ./.next/static

USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/ || exit 1
CMD ["node", "server.js"]
