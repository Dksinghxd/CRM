FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source files
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Expose port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Start the compiled app
CMD ["node", "dist/index.js"]
