# Deployment Guide

This guide covers deployment scenarios beyond basic development setup. For initial setup and configuration, see the [main README](../README.md).

## Table of Contents

- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [Cloud Deployment](#cloud-deployment)
- [NAS Deployment](#nas-deployment)
- [Security Setup](#security-setup)
- [Monitoring & Maintenance](#monitoring--maintenance)

## Prerequisites

Before deploying, ensure you have completed the basic setup from the [main README](../README.md):

- ✅ Discord bot configured
- ✅ Strava API credentials obtained  
- ✅ Environment variables configured
- ✅ Local development working

## Development Deployment

For local development setup, follow the [Quick Start guide](../README.md#-quick-start) in the main README.

### Development Tools

```bash
# Validate configuration
node utils/setup.js validate

# Generate new encryption key
node utils/setup.js generate-key

# Show setup instructions
node utils/setup.js instructions

# Check bot status
npm start -- --status
```

## Docker Deployment

### Local Docker Development

#### Prerequisites

- Docker and Docker Compose
- Configured `.env` file

#### Quick Deploy

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop services
docker-compose down
```

#### Docker Development Workflow

```bash
# Rebuild after code changes
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Access container shell
docker-compose exec strava-running-bot sh

# View real-time logs
docker-compose logs -f strava-running-bot

# Restart single service
docker-compose restart strava-running-bot
```

### Docker Configuration

#### Dockerfile Optimization

The included Dockerfile is optimized for production:

- **Multi-stage build** for smaller final image
- **Non-root user** for security
- **Health checks** for monitoring
- **Signal handling** with dumb-init
- **Dependency caching** for faster builds

#### Resource Limits

Adjust in `docker/docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 512M      # Adjust based on team size
      cpus: '0.5'       # Adjust based on activity volume
    reservations:
      memory: 256M
      cpus: '0.25'
```

#### Volume Management

```bash
# Backup member data
docker run --rm -v strava-running-bot_bot_data:/data -v $(pwd):/backup alpine tar czf /backup/bot_data_backup.tar.gz -C /data .

# Restore member data
docker run --rm -v strava-running-bot_bot_data:/data -v $(pwd):/backup alpine tar xzf /backup/bot_data_backup.tar.gz -C /data

# List volumes
docker volume ls

# Inspect volume
docker volume inspect strava-running-bot_bot_data
```

## Production Deployment

### Production Prerequisites

- **Domain name** with DNS control
- **SSL certificate** (Let's Encrypt recommended)
- **Reverse proxy** (nginx/Apache/Cloudflare)
- **Production server** (VPS/dedicated/cloud)
- **Monitoring solution** (optional but recommended)

### Production Environment Setup

#### 1. Server Preparation

```bash
# Update system (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment directory
sudo mkdir -p /opt/strava-running-bot
sudo chown $USER:$USER /opt/strava-running-bot
cd /opt/strava-running-bot
```

#### 2. Application Deployment

```bash
# Clone or upload application code
git clone <your-repo-url> .

# Create production environment file
cp .env.example .env
# Configure with production values

# Set production environment
sed -i 's/NODE_ENV=development/NODE_ENV=production/' .env

# Deploy with Docker Compose
docker-compose up -d

# Verify deployment
docker-compose ps
docker-compose logs -f
```

#### 3. Reverse Proxy Configuration

**Nginx Example:**

```nginx
# /etc/nginx/sites-available/strava-running-bot
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable the site:**

```bash
sudo ln -s /etc/nginx/sites-available/strava-running-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

#### 5. Strava Webhook Configuration

```bash
# Create production webhook
node utils/setup.js create-webhook https://your-domain.com/webhook/strava

# Verify webhook
curl -f https://your-domain.com/health
```

### Production Security

#### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Specific ports if not using reverse proxy
sudo ufw allow 3000/tcp
```

#### Environment Security

- **Never commit `.env` files** to version control
- **Use strong encryption keys** (32 bytes, cryptographically secure)
- **Regularly rotate secrets** (quarterly recommended)
- **Limit file permissions** (`chmod 600 .env`)
- **Monitor access logs** for suspicious activity

#### Container Security

```yaml
# Additional security options in docker/docker-compose.yml
security_opt:
  - no-new-privileges:true
  - seccomp:unconfined
read_only: true
tmpfs:
  - /tmp
  - /var/log
```

## Cloud Deployment

### Railway Deployment

#### Setup

1. Create account at [Railway](https://railway.app)
2. Connect GitHub repository
3. Configure environment variables
4. Deploy automatically

#### Configuration

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway deploy
```

### Heroku Deployment

#### Setup

```bash
# Install Heroku CLI
# Create Heroku app
heroku create strava-running-bot

# Configure environment variables
heroku config:set NODE_ENV=production
heroku config:set DISCORD_TOKEN=your_token
heroku config:set STRAVA_CLIENT_ID=your_id
# ... add all required environment variables

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

#### Heroku Configuration

Add `Procfile`:

```text
web: npm start
```

### DigitalOcean App Platform

#### Configuration

Create `app.yaml`:

```yaml
name: strava-running-bot
services:
- name: web
  source_dir: /
  github:
    repo: your-username/strava-running-bot
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "8080"
  # Add other environment variables
```

### AWS Deployment

#### ECS with Fargate

1. **Create ECR Repository**
2. **Build and push Docker image**
3. **Create ECS Task Definition**
4. **Deploy to Fargate service**
5. **Configure Application Load Balancer**

#### Docker Image for AWS

```bash
# Build for AWS
docker build -t strava-running-bot .

# Tag for ECR
docker tag strava-running-bot:latest <account-id>.dkr.ecr.<region>.amazonaws.com/strava-running-bot:latest

# Push to ECR
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/strava-running-bot:latest
```

## NAS Deployment

### Synology NAS

#### Prerequisites

- **Docker package** installed
- **SSH access** enabled
- **Port forwarding** configured on router

#### Deployment Steps

1. **Upload project files** via File Station
2. **SSH into NAS** and navigate to project directory
3. **Run Docker Compose**:

```bash
# SSH to NAS
ssh admin@your-nas-ip

# Navigate to project
cd /volume1/docker/strava-running-bot

# Start services
sudo docker-compose up -d

# Check status
sudo docker-compose ps
```

#### Synology Docker GUI

1. Open **Docker package**
2. Go to **Registry** and search for "node"
3. Download **node:24-alpine**
4. Create **Container** with project volume mounted
5. Configure **environment variables**
6. Start **container**

### QNAP NAS

#### Container Station

1. Install **Container Station**
2. Create **Docker Compose project**
3. Upload **docker/docker-compose.yml**
4. Configure **environment variables**
5. Deploy **stack**

### TrueNAS

#### TrueNAS SCALE

1. Navigate to **Apps**
2. Launch **Docker Compose**
3. Upload project **compose file**
4. Configure **storage and networking**
5. Deploy **application**

### NAS-Specific Considerations

#### Resource Allocation

- **CPU**: Limit to 25-50% of available cores
- **Memory**: Allocate 256-512MB based on team size
- **Storage**: Ensure sufficient space for logs and data

#### Network Configuration

- **Port Forwarding**: Forward external port to NAS port 3000
- **DDNS**: Configure dynamic DNS for domain access
- **Firewall**: Open necessary ports in NAS firewall

#### Backup Strategy

```bash
# Automated backup script for NAS
#!/bin/bash
BACKUP_DIR="/volume1/backups/strava-running-bot"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup Docker volumes
docker run --rm -v strava-running-bot_bot_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/bot_data_$DATE.tar.gz -C /data .

# Backup configuration
cp /volume1/docker/strava-running-bot/.env $BACKUP_DIR/env_$DATE.backup

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.backup" -mtime +30 -delete
```

## Environment Configuration

### Environment Variable Reference

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `NODE_ENV` | ✅ | `production` | Enables production optimizations |
| `PORT` | ❌ | `3000` | Application port |
| `DISCORD_TOKEN` | ✅ | Your bot token | From Discord Developer Portal |
| `DISCORD_CHANNEL_ID` | ✅ | Channel ID | Target Discord channel |
| `STRAVA_CLIENT_ID` | ✅ | Your client ID | From Strava API settings |
| `STRAVA_CLIENT_SECRET` | ✅ | Your client secret | From Strava API settings |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | ✅ | Random secure string | For webhook verification |
| `ENCRYPTION_KEY` | ✅ | 64-char hex string | For member data encryption |
| `GOOGLE_MAPS_API_KEY` | ❌ | Your API key | For route map display |

### Configuration Validation

```bash
# Validate all configuration
node utils/setup.js validate

# Test Discord connection
node utils/setup.js test-discord

# Test Strava API
node utils/setup.js test-strava

# Verify webhook endpoint
curl -f https://your-domain.com/health
```

## Security Setup

### Production Security Checklist

- [ ] **Environment variables** secured and not in version control
- [ ] **HTTPS/TLS** enabled with valid certificates
- [ ] **Firewall** configured to restrict access
- [ ] **Regular updates** automated or scheduled
- [ ] **Backup strategy** implemented and tested
- [ ] **Monitoring** configured for security events
- [ ] **Access logs** reviewed regularly
- [ ] **Encryption keys** rotated quarterly

### Security Monitoring

```bash
# Monitor failed authentication attempts
grep "401\|403" /var/log/nginx/access.log

# Check for unusual API usage
docker-compose logs | grep "ERROR\|WARN"

# Monitor resource usage
docker stats strava-running-bot
```

## Monitoring & Maintenance

### Health Monitoring

#### Basic Health Checks

```bash
# Application health
curl -f https://your-domain.com/health

# Docker health
docker-compose ps

# Nginx status
sudo systemctl status nginx

# SSL certificate expiry
sudo certbot certificates
```

#### Advanced Monitoring

**Prometheus + Grafana Setup:**

```yaml
# Add to docker/docker-compose.yml
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

### Log Management

#### Log Rotation

```bash
# Configure logrotate
sudo tee /etc/logrotate.d/strava-running-bot <<EOF
/opt/strava-running-bot/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        docker-compose -f /opt/strava-running-bot/docker/docker-compose.yml restart strava-running-bot
    endscript
}
EOF
```

#### Centralized Logging

**ELK Stack Example:**

```yaml
# Add to docker/docker-compose.yml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:7.14.0
  environment:
    - discovery.type=single-node

logstash:
  image: docker.elastic.co/logstash/logstash:7.14.0
  volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

kibana:
  image: docker.elastic.co/kibana/kibana:7.14.0
  ports:
    - "5601:5601"
```

### Maintenance Tasks

#### Daily Tasks

```bash
#!/bin/bash
# daily-maintenance.sh

# Check application health
curl -f https://your-domain.com/health || echo "Health check failed"

# Check disk space
df -h | awk '$5 > 80 {print "Disk usage high: " $0}'

# Check memory usage
free -h

# Check bot statistics
curl -s https://your-domain.com/members | jq '.total'
```

#### Weekly Tasks

```bash
#!/bin/bash
# weekly-maintenance.sh

# Update Docker images
docker-compose pull
docker-compose up -d

# Clean up old containers and images
docker system prune -f

# Backup member data
./backup-script.sh

# Check SSL certificate expiry
sudo certbot certificates | grep "VALID"

# Review access logs
tail -n 1000 /var/log/nginx/access.log | grep -v "200\|301\|302"
```

#### Monthly Tasks

- **Update dependencies**: `npm update` and rebuild Docker image
- **Security audit**: `npm audit` and review vulnerabilities
- **Performance review**: Analyze logs and metrics
- **Backup verification**: Test backup restoration process
- **Documentation update**: Update configuration and procedures

### Automation

#### Cron Jobs

```bash
# Add to crontab
crontab -e

# Daily health check at 6 AM
0 6 * * * /opt/strava-running-bot/daily-maintenance.sh

# Weekly maintenance on Sunday at 2 AM
0 2 * * 0 /opt/strava-running-bot/weekly-maintenance.sh

# Monthly backup cleanup on 1st of month at 3 AM
0 3 1 * * find /opt/backups -name "*.tar.gz" -mtime +90 -delete
```

#### Systemd Service (Alternative to Docker)

```ini
# /etc/systemd/system/strava-running-bot.service
[Unit]
Description=Strava Running Bot
After=network.target

[Service]
Type=simple
User=stravabot
WorkingDirectory=/opt/strava-running-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Troubleshooting Deployment Issues

### Common Deployment Problems

#### Docker Build Failures

```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Check for dependency issues
docker-compose logs strava-running-bot
```

#### Environment Variable Issues

```bash
# Verify environment variables
docker-compose config

# Check variable substitution
docker-compose exec strava-running-bot env | grep -E "(DISCORD|STRAVA)"

# Test configuration validation
docker-compose exec strava-running-bot node utils/setup.js validate
```

#### Network Connectivity Issues

```bash
# Test internal connectivity
docker-compose exec strava-running-bot curl -f http://localhost:3000/health

# Test external connectivity
curl -f https://your-domain.com/health

# Check port binding
netstat -tulpn | grep 3000

# Verify reverse proxy
sudo nginx -t
```

#### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Test SSL configuration
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Renew certificate manually
sudo certbot renew --force-renewal
```

### Performance Optimization

#### Application Performance

- **Memory optimization**: Monitor memory usage and adjust limits
- **CPU optimization**: Profile CPU usage during peak activity
- **Database optimization**: Optimize member data storage and access
- **Caching**: Implement Redis for frequently accessed data

#### Infrastructure Performance

- **Load balancing**: Use multiple instances for high availability
- **CDN integration**: Cache static assets with CloudFlare/AWS CloudFront
- **Database scaling**: Consider external database for large teams
- **Monitoring**: Implement APM tools for performance insights

## Support and Resources

### Getting Help

1. **Check logs**: Always start with application and system logs
2. **Verify configuration**: Use validation tools and health checks
3. **Test components**: Isolate issues by testing individual components
4. **Community support**: Check GitHub issues and discussions
5. **Professional support**: Consider hiring DevOps consultant for complex deployments

### Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Production Deployment](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Discord Bot Best Practices](https://discordjs.guide/)
- [Strava API Documentation](https://developers.strava.com/docs/)

---

This deployment guide should cover most scenarios you'll encounter. For specific questions or issues not covered here, please refer to the main documentation or create an issue in the project repository.
