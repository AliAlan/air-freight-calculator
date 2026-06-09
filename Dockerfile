FROM node:20-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ .
# DATABASE_URL is only needed at runtime, but Prisma validate reads it at build time too.
# Set a placeholder so `prisma generate` succeeds; the real value is injected by Render at startup.
ENV DATABASE_URL=file:./prod.db
RUN npx prisma generate
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node prisma/seed.js && node src/server.js"]
