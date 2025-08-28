# Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with the Strava Running Bot.

## Table of Contents

- [Quick Diagnostic Steps](#quick-diagnostic-steps)
- [Bot Connection Issues](#bot-connection-issues)
- [Member Registration Problems](#member-registration-problems)
- [Activity Posting Issues](#activity-posting-issues)
- [Discord Command Problems](#discord-command-problems)
- [Webhook Issues](#webhook-issues)
- [Performance Problems](#performance-problems)
- [Data and Storage Issues](#data-and-storage-issues)
- [Docker Deployment Issues](#docker-deployment-issues)
- [Network and Connectivity](#network-and-connectivity)
- [Security and Authentication](#security-and-authentication)
- [Logging and Monitoring](#logging-and-monitoring)

## Quick Diagnostic Steps

### 1. First Response Checklist

When something goes wrong, follow these steps in order:

```bash
# 1. Check if the bot is running
curl http://localhost:3000/health

# 2. Check recent logs
docker-compose logs --tail=50 strava-running-bot

# 3. Check bot status in Discord
# Look for bot online status in member list

# 4. Verify configuration
node utils/setup.js validate

# 5. Check system resources
docker stats strava-running-bot
```

### 2. Health Check Status Codes

| Status | Description | Action |
|--------|-------------|--------|
| `200` | Healthy | ✅ Bot is working normally |
| `503` | Unhealthy | ❌ Check logs and dependencies |
| `No response` | Not running | ❌ Check if service is started |

### 3. Quick Fix Commands

```bash
# Restart the bot
docker-compose restart strava-running-bot

# View real-time logs
docker-compose logs -f strava-running-bot

# Check Docker status
docker-compose ps

# Rebuild if needed
docker-compose down && docker-compose up -d --build
```

## Bot Connection Issues

### Discord Bot Not Responding

#### Symptoms

- Bot appears offline in Discord
- Slash commands don't appear
- No response to commands
- Bot doesn't post activities

#### Diagnostic Steps

```bash
# Check Discord connection in logs
docker-compose logs strava-running-bot | grep -i discord

# Verify bot token
echo $DISCORD_TOKEN | wc -c  # Should be around 70 characters

# Test bot permissions
# Try inviting bot again with correct permissions
```

#### Common Causes & Solutions

1. Invalid Bot Token

   ```bash
   # Error: "Invalid token"
   # Solution: Regenerate token in Discord Developer Portal
   # Update DISCORD_TOKEN in .env file
   # Restart bot
   ```

2. Missing Permissions

   ```bash
   # Error: "Missing permissions"
   # Solution: Check bot invite URL includes required    permissions:
   # - Send Messages
   # - Use Slash Commands  
   # - Embed Links
   # - Attach Files
   ```

3. Bot Kicked from Server

   ```bash
   # Error: "Unknown Guild" or similar
   # Solution: Re-invite bot to server
   # Check server audit logs for kick/ban events
   ```

4. Rate Limiting

   ```bash
   # Error: "Rate limited"
   # Check logs for rate limit messages
   # Wait for rate limit to reset (usually 1 hour)
   # Reduce command usage frequency
   ```

### Slash Commands Not Appearing

#### Symptoms

- Commands don't show up when typing `/`
- Commands are outdated
- Some commands missing

#### Solutions

```bash
# 1. Wait for propagation (can take up to 1 hour)

# 2. Force command refresh by restarting bot
docker-compose restart strava-running-bot

# 3. Check command registration in logs
docker-compose logs strava-running-bot | grep -i "command"

# 4. For immediate testing, register to specific guild
# Edit src/discord/bot.js and add guild ID for faster registration
```

## Member Registration Problems

### Registration Process Failing

#### Symptoms

- Users can't complete Strava authorization
- Registration URL returns error
- Members not appearing in `/members list`

#### Diagnostic Steps

```bash
# Check registration endpoint
curl http://localhost:3000/auth/strava?user_id=123456789

# Check Strava API credentials
node utils/setup.js validate

# Monitor registration process
docker-compose logs -f strava-running-bot | grep -i "register\|oauth"
```

#### Common Issues

1. Invalid Redirect URI

   ```bash
   # Error: "redirect_uri_mismatch"
   # Check Strava app settings match your domain
   # Ensure HTTPS in production
   # Verify Authorization Callback Domain in Strava app
   ```

2. Strava API Credentials Wrong

   ```bash
   # Error: "invalid_client"
   # Verify STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET
   # Check credentials are not swapped
   # Ensure no extra spaces in .env file
   ```

3. Member Data Not Saving

   ```bash
   # Check member storage
   curl http://localhost:3000/members
   
   # Check file permissions
   ls -la data/
   
   # Check encryption key
   echo $ENCRYPTION_KEY | wc -c  # Should be 64 characters
   ```

### Member Token Issues

#### Symptoms

- "Unable to access activities" errors
- Member activities not posting
- Token refresh failures

#### Solutions

```bash
# Check member token status
curl http://localhost:3000/members | jq '.members[] | select(.isActive == false)'

# Check token refresh logs
docker-compose logs strava-running-bot | grep -i "token\|refresh"

# Force member re-registration
curl -X POST http://localhost:3000/members/discord/USER_ID/delete
# Then have member register again
```

## Activity Posting Issues

### Activities Not Appearing in Discord

#### Symptoms

- Members complete activities but nothing posts to Discord
- Some activities post, others don't
- Delayed activity posting

#### Diagnostic Steps

```bash
# Check webhook events
docker-compose logs strava-running-bot | grep -i webhook

# Check activity processing
docker-compose logs strava-running-bot | grep -i "activity\|processing"

# Test webhook endpoint manually
curl -X POST http://localhost:3000/webhook/strava \
  -H "Content-Type: application/json" \
  -d '{"object_type":"activity","aspect_type":"create","object_id":123,"owner_id":456}'
```

#### Common Causes

1. Webhook Not Configured

   ```bash
   # Check webhook subscription
   node utils/setup.js list-webhooks
   
   # Create webhook if missing
   node utils/setup.js create-webhook https://your-domain.com/   webhook/strava
   
   # Verify webhook endpoint accessible
   curl -f https://your-domain.com/webhook/strava
   ```

2. Activity Filtering

   ```bash
   # Check activity filters in logs
   # Activities are filtered if:
   # - Older than 24 hours
   # - Less than 1 minute duration
   # - Less than 100m distance
   # - Manual entries without GPS data
   
   # Check filter logs
   docker-compose logs strava-running-bot | grep -i "skip\|   filter"
   ```

3. Member Authorization Issues

   ```bash
   # Check member active status
   curl http://localhost:3000/members | jq '.members[] | select   (.isActive == false)'
   
   # Check token expiry
   # Tokens refresh automatically, check logs for refresh    errors
   docker-compose logs strava-running-bot | grep -i "token.   *error"
   ```

### Incorrect Activity Data

#### Symptoms

- Missing pace, distance, or heart rate data
- Wrong activity formatting
- Broken route maps

#### Solutions

1. Missing Activity Fields

   ```bash
   # Check Strava API response structure
   # Some activities may not have all data fields
   # Heart rate requires compatible device
   # GAP requires elevation data
   ```

2. Route Map Issues

   ```bash
   # Check Google Maps API key (optional)
   # Verify GOOGLE_MAPS_API_KEY in .env
   # Maps work without API key but may have limitations
   ```

3. Formatting Problems

   ```bash
   # Check activity processing logs
   docker-compose logs strava-running-bot | grep -i "format\|   embed"
   
   # Test embed generation manually by triggering /last command
   ```

## Discord Command Problems

### Commands Not Working

#### Symptoms

- Commands return errors
- "Application did not respond" messages
- Commands hang or timeout

#### Diagnostic Steps

```bash
# Check command handler logs
docker-compose logs strava-running-bot | grep -i "command\|interaction"

# Test specific command
# Use /botstatus to test basic functionality

# Check bot permissions
# Ensure bot has required permissions in channel
```

#### Solutions

1. Permission Errors

   ```bash
   # Verify bot has these permissions:
   # - Send Messages
   # - Use Slash Commands
   # - Embed Links
   # - Read Message History
   
   # Check channel-specific permissions
   # Bot may have server permissions but not channel    permissions
   ```

2. Command Timeout

   ```bash
   # Commands must respond within 3 seconds
   # Check for slow API calls in logs
   # Verify Strava API response times
   ```

3. Database Errors

   ```bash
   # Check member data access
   curl http://localhost:3000/members
   
   # Check file system permissions
   ls -la data/
   ```

### Member Commands Failing

#### Symptoms

- `/members list` shows empty or errors
- `/members remove` doesn't work
- `/last` command can't find members

#### Solutions

```bash
# Check member data
curl http://localhost:3000/members

# Verify member file exists and is readable
ls -la data/members.json

# Check member data format
cat data/members.json | jq '.'

# Reload member data by restarting bot
docker-compose restart strava-running-bot
```

## Webhook Issues

### Webhook Events Not Received

#### Symptoms

- Activities complete but no webhook events
- Webhook verification failing
- Strava reports webhook errors

#### Diagnostic Steps

```bash
# Check webhook registration
node utils/setup.js list-webhooks

# Test webhook endpoint externally
curl -f https://your-domain.com/webhook/strava

# Check webhook verification
curl "http://localhost:3000/webhook/strava?hub.challenge=test&hub.verify_token=YOUR_VERIFY_TOKEN"
```

#### Solutions

1. Webhook URL Incorrect

   ```bash
   # Verify webhook URL is publicly accessible
   # Must be HTTPS in production
   # Must return 200 for verification requests
   
   # Update webhook if needed
   node utils/setup.js delete-webhook OLD_SUBSCRIPTION_ID
   node utils/setup.js create-webhook https://your-domain.com/   webhook/strava
   ```

2. Verification Token Mismatch

   ```bash
   # Check STRAVA_WEBHOOK_VERIFY_TOKEN matches what you set in    webhook
   # Verify no extra spaces or characters in .env
   echo "$STRAVA_WEBHOOK_VERIFY_TOKEN" | hexdump -C
   ```

3. Rate Limiting

   ```bash
   # Strava may throttle webhook deliveries
   # Check webhook subscription rate limits
   # Monitor webhook event frequency in logs
   ```

### Webhook Processing Errors

#### Symptoms

- Webhook events received but not processed
- Processing errors in logs
- Partial activity posting

#### Solutions

```bash
# Check webhook processing logs
docker-compose logs strava-running-bot | grep -i "webhook.*error"

# Check member lookup for webhook events
# Ensure webhook owner_id matches registered member athlete_id

# Test webhook processing manually
curl -X POST http://localhost:3000/webhook/strava \
  -H "Content-Type: application/json" \
  -d '{"object_type":"activity","aspect_type":"create","object_id":123,"owner_id":MEMBER_ATHLETE_ID}'
```

## Performance Problems

### Slow Response Times

#### Symptoms

- Commands take long time to respond
- Activities post with delay
- Health checks timing out

#### Diagnostic Steps

```bash
# Check resource usage
docker stats strava-running-bot

# Check memory usage
docker-compose exec strava-running-bot free -h

# Check CPU usage
docker-compose exec strava-running-bot top

# Check disk I/O
iostat -x 1 5
```

#### Solutions

1. Resource Constraints

   ```bash
   # Increase Docker memory limit in docker/docker-compose.yml
   # Increase CPU allocation
   # Monitor resource usage patterns
   
   # Check for memory leaks
   docker-compose logs strava-running-bot | grep -i "memory\|   oom"
   ```

2. API Rate Limiting

   ```bash
   # Check Strava API rate limit headers in logs
   # Implement exponential backoff for retries
   # Monitor API quota usage
   
   # Check rate limit status
   # Look for 429 responses in logs
   ```

3. Database Performance

   ```bash
   # Check member data file size
   ls -lh data/members.json
   
   # Consider implementing database if file gets large
   # Implement data pagination for large teams
   ```

### High Memory Usage

#### Symptoms

- Container memory usage growing over time
- Out of memory errors
- Container restarts due to memory

#### Solutions

```bash
# Check for memory leaks
docker-compose exec strava-running-bot node --expose-gc -e "
  console.log('Memory before GC:', process.memoryUsage());
  global.gc();
  console.log('Memory after GC:', process.memoryUsage());
"

# Restart bot periodically as workaround
# Add to crontab: 0 4 * * * docker-compose restart strava-running-bot

# Monitor memory usage trends
# Set up alerts for high memory usage
```

## Data and Storage Issues

### Member Data Corruption

#### Symptoms

- Members disappear from list
- Registration data lost
- Encrypted data can't be decrypted

#### Diagnostic Steps

```bash
# Check member data file
cat data/members.json | jq '.'

# Verify backup exists
ls -la backups/

# Check file permissions
ls -la data/
```

#### Solutions

1. Restore from Backup

   ```bash
   # List available backups
   ls -la backups/
   
   # Restore latest backup
   cp backups/members_backup_LATEST.json data/members.json
   docker-compose restart strava-running-bot
   ```

2. Encryption Key Issues

   ```bash
   # Verify encryption key hasn't changed
   echo $ENCRYPTION_KEY | wc -c  # Should be 64 characters
   
   # If key lost, members need to re-register
   # Clear data and start fresh
   rm data/members.json
   docker-compose restart strava-running-bot
   ```

3. File Corruption

   ```bash
   # Check for valid JSON
   cat data/members.json | jq '.' || echo "Invalid JSON"
   
   # Manual repair if possible
   # Or restore from backup
   ```

### Storage Space Issues

#### Symptoms

- "No space left on device" errors
- Log files growing too large
- Container can't write data

#### Solutions

```bash
# Check disk space
df -h

# Clean up Docker
docker system prune -f

# Clean up logs
docker-compose logs --tail=1000 strava-running-bot > /tmp/recent.log
echo "" > /var/lib/docker/containers/*/strava-running-bot*-json.log

# Set up log rotation
# Add to docker/docker-compose.yml:
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Docker Deployment Issues

### Container Won't Start

#### Symptoms

- Docker container exits immediately
- Build failures
- Port binding errors

#### Diagnostic Steps

```bash
# Check container status
docker-compose ps

# Check container logs
docker-compose logs strava-running-bot

# Check build logs
docker-compose build strava-running-bot

# Check port conflicts
netstat -tulpn | grep 3000
```

#### Solutions

1. Build Failures

   ```bash
   # Clear Docker cache
   docker system prune -a
   
   # Rebuild without cache
   docker-compose build --no-cache strava-running-bot
   
   # Check docker/Dockerfile syntax
   docker build -t test .
   ```

2. Port Conflicts

   ```bash
   # Change port in docker/docker-compose.yml
   ports:
     - "3001:3000"  # Use different external port
   
   # Or stop conflicting service
   sudo lsof -ti:3000 | xargs kill -9
   ```

3. Permission Issues

   ```bash
   # Check file ownership
   ls -la .env data/
   
   # Fix permissions
   chmod 644 .env
   chmod 755 data/
   ```

### Docker Compose Issues

#### Symptoms

- Services don't start together
- Environment variables not loaded
- Volume mounting fails

#### Solutions

```bash
# Validate compose file
docker-compose config

# Check environment file
cat .env | grep -v "^#" | grep -v "^$"

# Check volume mounting
docker-compose exec strava-running-bot ls -la /app/data

# Recreate containers
docker-compose down -v
docker-compose up -d
```

## Network and Connectivity

### External Access Issues

#### Symptoms

- Can't access bot from outside network
- Webhook URL not reachable
- SSL certificate errors

#### Diagnostic Steps

```bash
# Test local access
curl http://localhost:3000/health

# Test external access
curl https://your-domain.com/health

# Check port forwarding
nmap -p 3000 your-external-ip

# Check SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

#### Solutions

1. Port Forwarding

   ```bash
   # Configure router to forward external port to internal    port 3000
   # Check router admin panel
   # Verify external IP and port accessibility
   ```

2. Firewall Issues

   ```bash
   # Check local firewall
   sudo ufw status
   
   # Allow port through firewall
   sudo ufw allow 3000/tcp
   
   # Check cloud provider security groups
   # Ensure port 3000 (or 443 for HTTPS) is open
   ```

3. Reverse Proxy Issues

   ```bash
   # Check nginx configuration
   sudo nginx -t
   
   # Check nginx logs
   sudo tail -f /var/log/nginx/error.log
   
   # Restart nginx
   sudo systemctl restart nginx
   ```

### DNS and Domain Issues

#### Symptoms

- Domain doesn't resolve to server
- Intermittent connectivity
- SSL certificate validation fails

#### Solutions

```bash
# Check DNS resolution
nslookup your-domain.com

# Check DNS propagation
dig your-domain.com

# Update DNS records if needed
# Point A record to your server IP

# Check SSL certificate renewal
sudo certbot certificates
sudo certbot renew --dry-run
```

## Security and Authentication

### Authentication Failures

#### Symptoms

- Strava OAuth fails
- Discord bot can't authenticate
- API keys rejected

#### Diagnostic Steps

```bash
# Check API credentials
node utils/setup.js validate

# Test Discord authentication
# Check bot token validity in Discord Developer Portal

# Test Strava authentication
# Try manual OAuth flow in browser
```

#### Solutions

1. Expired Credentials

   ```bash
   # Regenerate Discord bot token
   # Update DISCORD_TOKEN in .env
   
   # Check Strava app status
   # Ensure app is not suspended or rate limited
   ```

2. Scope Issues

   ```bash
   # Verify Strava OAuth scopes
   # Required: read,activity:read_all,profile:read_all
   
   # Check member authorization scopes
   curl http://localhost:3000/members | jq '.members[].tokens'
   ```

### Security Errors

#### Symptoms

- Webhook signature validation fails
- Encryption/decryption errors
- Unauthorized access attempts

#### Solutions

```bash
# Check webhook verification token
echo $STRAVA_WEBHOOK_VERIFY_TOKEN

# Verify encryption key integrity
echo $ENCRYPTION_KEY | wc -c  # Should be exactly 64 characters

# Check for unauthorized access in logs
docker-compose logs strava-running-bot | grep -i "401\|403\|unauthorized"

# Rotate keys if compromised
# Generate new encryption key
# Have all members re-register
```

## Logging and Monitoring

### Insufficient Logging

#### Symptoms

- Can't diagnose issues
- Missing error details
- No audit trail

#### Solutions

```bash
# Increase log verbosity
# Set NODE_ENV=development for more detailed logs

# Enable debug logging for specific components
# Add DEBUG=* environment variable

# Set up structured logging
# Consider implementing Winston or similar logging library
```

### Log Analysis

#### Common Log Patterns

```bash
# Successful activity posting
grep "✅.*Posted activity" logs/

# Failed member operations
grep "❌.*member" logs/

# API rate limiting
grep "rate.*limit" logs/

# Authentication issues
grep -i "auth.*error\|token.*error" logs/

# Network connectivity issues
grep -i "connect.*error\|timeout" logs/
```

### Setting Up Monitoring

#### Basic Monitoring

```bash
# Health check script
#!/bin/bash
while true; do
  if curl -sf http://localhost:3000/health > /dev/null; then
    echo "$(date): Bot healthy"
  else
    echo "$(date): Bot unhealthy - restarting"
    docker-compose restart strava-running-bot
  fi
  sleep 300  # Check every 5 minutes
done
```

#### Advanced Monitoring

```yaml
# Add Prometheus monitoring to docker/docker-compose.yml
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

# Configure alerts for:
# - Bot health status
# - High memory usage
# - Failed API calls
# - Member registration failures
```

## Getting Additional Help

### Information to Collect

When seeking help, collect this information:

```bash
# System information
uname -a
docker --version
docker-compose --version

# Configuration validation
node utils/setup.js validate

# Recent logs
docker-compose logs --tail=100 strava-running-bot

# Member statistics
curl http://localhost:3000/members

# Health status
curl http://localhost:3000/health

# Resource usage
docker stats strava-running-bot --no-stream
```

### Support Channels

1. **GitHub Issues**: For bugs and feature requests
2. **Documentation**: Check all documentation files
3. **Community**: Discord/Reddit communities for general help
4. **Professional**: Consider DevOps consultation for complex issues

### Creating Bug Reports

Include this information in bug reports:

- **Environment**: Development/Production, Docker/Native
- **Steps to reproduce**: Exact commands and actions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Logs**: Relevant log excerpts (sanitize sensitive data)
- **Configuration**: Sanitized configuration details
- **System info**: OS, Node.js version, Docker version

---

This troubleshooting guide should help you resolve most issues you'll encounter. For problems not covered here, please create a detailed bug report with the information specified above.
