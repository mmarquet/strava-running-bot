# Docker Deployment for Strava Running Bot

This directory contains all the necessary files to deploy the Strava Running Bot on your NAS using Docker.

## 📁 Files Overview

- `docker/Dockerfile` - Container image definition
- `docker/docker-compose.yml` - Multi-container deployment configuration
- `.dockerignore` - Files to exclude from Docker build context
- `README.md` - This deployment guide

## 🚀 Quick Start

### Prerequisites

1. **Docker and Docker Compose** installed on your NAS
2. **Configured .env file** in the parent directory with all required credentials

### Step 1: Prepare Environment

```bash
# Navigate to your bot directory
cd /path/to/strava-running-bot

# Ensure your .env file is properly configured
cp .env.example .env
# Edit .env with your actual credentials
```

### Step 2: Deploy with Docker Compose

```bash
# Build and start the bot
docker-compose up -d

# Check logs
docker-compose logs -f

# Check status
docker-compose ps
```

## 🔧 Configuration

### Environment Variables

Make sure your `.env` file contains:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_discord_channel_id

# Strava API Configuration
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Server Configuration
PORT=3000
NODE_ENV=production

# Security
ENCRYPTION_KEY=your_32_character_encryption_key
```

### Port Configuration

The bot runs on port 3000 by default. You can change this in the docker/docker-compose.yml:

```yaml
ports:
  - "YOUR_PORT:3000"  # Change YOUR_PORT to desired port
```

### Resource Limits

Adjust resource limits in docker/docker-compose.yml based on your NAS capabilities:

```yaml
deploy:
  resources:
    limits:
      memory: 512M      # Adjust memory limit
      cpus: '0.5'       # Adjust CPU limit
```

## 📊 Monitoring

### Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker-compose ps

# View health check logs
docker inspect strava-running-bot | grep -A 10 Health
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs for specific timeframe
docker-compose logs --since="1h"
```

### Access Bot Status

```bash
# Check bot health endpoint
curl http://localhost:3000/health

# View member list
curl http://localhost:3000/members
```

## 🔄 Management Commands

### Start/Stop

```bash
# Start the bot
docker-compose up -d

# Stop the bot
docker-compose down

# Restart the bot
docker-compose restart
```

### Updates

```bash
# Pull latest code and rebuild
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Data

```bash
# Backup member data volume
docker run --rm -v strava-running-bot_bot_data:/data -v $(pwd):/backup alpine tar czf /backup/bot_data_backup.tar.gz -C /data .

# Restore from backup
docker run --rm -v strava-running-bot_bot_data:/data -v $(pwd):/backup alpine tar xzf /backup/bot_data_backup.tar.gz -C /data
```

## 🛠 Troubleshooting

### Common Issues

1. **Bot won't start**

   ```bash
   # Check logs for errors
   docker-compose logs
   
   # Verify environment variables
   docker-compose config
   ```

2. **Permission errors**

   ```bash
   # Check file permissions
   ls -la ../
   
   # Fix if needed
   chmod 644 ../.env
   ```

3. **Port conflicts**

   ```bash
   # Check what's using port 3000
   netstat -tulpn | grep 3000
   
   # Change port in docker/docker-compose.yml
   ```

4. **Memory issues**

   ```bash
   # Check container resources
   docker stats strava-running-bot
   
   # Adjust limits in docker/docker-compose.yml
   ```

### Container Shell Access

```bash
# Access container shell for debugging
docker-compose exec strava-running-bot sh

# Run commands inside container
docker-compose exec strava-running-bot npm run --help
```

## 🔐 Security Considerations

### Network Security

- The bot only exposes port 3000 for webhooks
- Consider using a reverse proxy (nginx) for HTTPS
- Restrict access to your NAS network only

### Data Security

- Member data is encrypted using the ENCRYPTION_KEY
- Data is stored in Docker volumes for persistence
- Regular backups are recommended

### Container Security

- Runs as non-root user (botuser)
- Uses minimal Alpine Linux base image
- Security options prevent privilege escalation

## 🌐 Production Setup

### Reverse Proxy (Optional)

For production with HTTPS, consider using nginx:

```yaml
# Add to docker/docker-compose.yml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
    - ./ssl:/etc/nginx/ssl
  depends_on:
    - strava-running-bot
```

### Webhook Configuration

For production, you'll need to:

1. Set up a domain/subdomain pointing to your NAS
2. Configure port forwarding on your router
3. Set up HTTPS (Let's Encrypt recommended)
4. Update Strava webhook URL to your domain

```bash
# Create Strava webhook subscription
node utils/setup.js create-webhook https://your-domain.com/webhook/strava
```

## 📋 Maintenance

### Regular Tasks

1. **Monitor logs** for errors
2. **Check disk space** for data volume
3. **Update dependencies** monthly
4. **Backup member data** weekly
5. **Monitor resource usage**

### Auto-restart

The container is configured with `restart: unless-stopped` to automatically restart on failures or NAS reboots.

## 🆘 Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify configuration: `docker-compose config`
3. Test health endpoint: `curl http://localhost:3000/health`
4. Check Discord bot permissions and channel access
5. Verify Strava API credentials and quotas

For more help, refer to the main README.md in the parent directory.
