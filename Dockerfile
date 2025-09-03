# Use Node.js 24 Alpine for smaller image size
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install additional packages (dumb-init, curl, su-exec)
RUN apk add --no-cache \
    dumb-init \
    curl \
    su-exec \
    && rm -rf /var/cache/apk/*

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001 -G nodejs

# Create data directory and set safe default ownership (will be enforced at container start)
RUN mkdir -p /app/data && \
    chown -R botuser:nodejs /app

# Copy application code
COPY --chown=botuser:nodejs . .

# Add entrypoint script that ensures data folder exists and is owned by botuser, then drops to botuser
RUN cat > /usr/local/bin/entrypoint.sh <<'EOF'
#!/bin/sh
set -e

# Ensure data directory exists and set proper ownership
mkdir -p /app/data
if ! chown -R botuser:nodejs /app/data; then
    echo "Warning: Could not set data directory ownership" >&2
fi

# If first arg starts with '-' assume it's flags for npm start
if [ "${1#-}" != "$1" ]; then
  set -- npm start "$@"
fi

# Exec the given command as botuser
exec su-exec botuser "$@"
EOF

RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/entrypoint.sh"]

# Start the application
CMD ["npm", "start"]
