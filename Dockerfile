# Use Node.js 22 Alpine for smaller image size
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install additional packages for better security and functionality
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001 -G nodejs

# Create data directory and set permissions
RUN mkdir -p /app/data && \
    chown -R botuser:nodejs /app

# Copy application code
COPY --chown=botuser:nodejs . .

# Switch to non-root user
USER botuser

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]