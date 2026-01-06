# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies (production only for smaller image)
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application's source code
COPY . .

# Run the build script (if you have dev dependencies needed for build, install them first)
RUN npm run build && npm prune --production

# Create a non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /usr/src/app
USER appuser

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Define the command to run your app
CMD [ "node", "dist/server.js" ]