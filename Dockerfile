# Use latest Node.js 24 LTS 
FROM node:25-bullseye-slim

# Set working directory
WORKDIR /app

# Install runtime dependencies only (no build tools needed!)
RUN apt-get update && apt-get install -y \
    dumb-init \
    curl \
    sqlite3 \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies - no compilation needed with native SQLite!
RUN npm ci --omit=dev && \
    npm cache clean --force

# Create non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home botuser

# Create data directory and set safe default ownership (will be enforced at container start)
RUN mkdir -p /app/data && \
    chown -R botuser:nodejs /app

# Copy application source code (excluding items in .dockerignore)
COPY --chown=botuser:nodejs src/ ./src/
COPY --chown=botuser:nodejs config/ ./config/
COPY --chown=botuser:nodejs utils/ ./utils/

# Add entrypoint script that ensures data folder exists and is owned by botuser, then drops to botuser
RUN cat > /usr/local/bin/entrypoint.sh <<'EOF'
#!/bin/bash
set -e

# Ensure data directory exists and set proper ownership
mkdir -p /app/data
if ! chown -R botuser:nodejs /app/data; then
    echo "Warning: Could not set data directory ownership" >&2
fi

# Run database migration on startup
echo "Running database migration..."
if ! gosu botuser node src/database/migrate.js; then
    echo "Warning: Database migration failed" >&2
fi

# If first arg starts with '-' assume it's flags for npm start
if [ "${1#-}" != "$1" ]; then
  set -- npm start "$@"
fi

# Exec the given command as botuser
exec gosu botuser "$@"
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
