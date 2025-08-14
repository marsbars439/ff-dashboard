# Backend Dockerfile
FROM node:18-alpine

# Install build dependencies for SQLite3
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and rebuild SQLite3 for Alpine
RUN npm ci --only=production && \
    npm rebuild sqlite3

# Copy source code
COPY . .

# Create data directory for SQLite
RUN mkdir -p data uploads

# Initialize database
RUN npm run init-db

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]