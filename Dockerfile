FROM oven/bun:1.4.4

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile && bun run build

ENV NODE_ENV=production
ENV LAB_HOST=0.0.0.0
ENV LAB_STORAGE_PATH=/data/lab.sqlite

EXPOSE 3000

CMD ["sh", "-c", "bun run db:migrate && bun run start"]
