# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm install --omit=dev

# Generate Prisma client
RUN npx prisma generate

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs

EXPOSE 4000

CMD ["node", "dist/index.js"]
