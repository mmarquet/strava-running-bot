# Strava Running Bot 🏃‍♂️

A comprehensive Discord bot that automatically posts Strava activities from your running team members to a dedicated Discord channel. Built with real-time webhooks, rich activity displays, and complete team management functionality.

![Discord Bot](https://img.shields.io/badge/Discord-Bot-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Strava](https://img.shields.io/badge/Strava-API-FC4C02?style=for-the-badge&logo=strava&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-LTS-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mmarquet_strava-running-bot&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mmarquet_strava-running-bot)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=mmarquet_strava-running-bot&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=mmarquet_strava-running-bot)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=mmarquet_strava-running-bot&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=mmarquet_strava-running-bot)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=mmarquet_strava-running-bot&metric=bugs)](https://sonarcloud.io/summary/new_code?id=mmarquet_strava-running-bot)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=mmarquet_strava-running-bot&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=mmarquet_strava-running-bot)

## 🎯 Features

### 🏃 **Real-time Activity Posting**

- Automatically posts new activities from team members via Strava webhooks
- Rich Discord embeds with comprehensive activity information
- Supports all activity types (running, cycling, swimming, etc.)
- Posts both public and private activities from registered members

### 📊 **Comprehensive Activity Display**

- **Activity name and description**
- **Distance, time, and pace**
- **Grade Adjusted Pace (GAP)** for hill-adjusted performance
- **Average heart rate** and elevation gain
- **Route map visualization** (with optional Google Maps integration)
- **Direct links to Strava activities**
- **Activity type-specific styling and icons**

### 👥 **Team Management**

- Support for 40+ team members with secure token management
- OAuth2 authentication flow with encrypted token storage
- Member registration, deactivation, and removal
- Discord slash commands for easy team management
- Web-based registration system
- **Per-member private activity access control** (`canViewPrivateActivity` flag, self-toggle only)

### 🎮 **Discord Integration**

- **Slash Commands**: `/members`, `/register`, `/last`, `/botstatus`
- **Member Management**: Add, remove, activate/deactivate members
- **Activity Lookup**: View any member's latest activity on-demand
- **Admin Controls**: Permission-based management commands
- **Autocomplete**: Smart member name suggestions

### 🔒 **Security & Reliability**

- Encrypted token storage with AES-256 encryption
- Non-blocking asynchronous operations
- Graceful error handling and token refresh
- Health monitoring and status endpoints
- Docker-ready with security best practices

## 🚀 Quick Start

### Prerequisites

- Node.js (check package.json for the exact version as its subject to change in the future)
- Discord bot token and server permissions
- Strava API application credentials
- Public domain/server for webhooks (production only)

### Installation

1. **Clone and Setup**

   ```bash
   git clone https://github.com/mmarquet/strava-running-bot.git
   cd strava-running-bot
   npm install
   ```

2. **Configure Environment**

   ```bash
   cp .env.example .env
   # Edit .env with your API credentials (see detailed setup guide below)
   ```

3. **Start Development**

   ```bash
   npm run dev
   ```

4. **Deploy with Docker** (Optional)

   ```bash
   docker compose -f docker-compose.yml up -d
   ```

> **💡 Need help getting credentials?** Follow the [Complete Setup Guide](#-complete-setup-guide) below for detailed instructions.

## 📋 Complete Setup Guide

**Need detailed instructions?** Follow these step-by-step guides to get all required credentials and configure your bot.

### 1. Discord Bot Setup

#### Step 1: Create a Discord Application

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** button (top right)
3. Enter a name for your bot (e.g., "Strava Running Bot")
4. Click **"Create"**

#### Step 2: Create and Configure the Bot

1. In the left sidebar, click **"Bot"**
2. Click **"Add Bot"** (if not already created)
3. Under **"Token"** section:
   - Click **"Copy"** to get your bot token
   - **⚠️ IMPORTANT**: Keep this token secret! It gives full access to your bot
   - Paste this token in your `.env` file as `DISCORD_TOKEN`

#### Step 3: Configure Bot Permissions

1. Still in the Bot section, scroll down to **"Privileged Gateway Intents"**
2. Enable **"Message Content Intent"** (required for some features)

#### Step 4: Generate Bot Invite Link

1. In the left sidebar, click **"OAuth2"** → **"URL Generator"**
2. Under **"Scopes"**, select:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Under **"Bot Permissions"**, select:
   - ✅ `Send Messages`
   - ✅ `Use Slash Commands`
   - ✅ `Embed Links`
   - ✅ `Attach Files`
   - ✅ `Read Message History`
   - ✅ `Use External Emojis`
4. Copy the generated URL at the bottom

#### Step 5: Add Bot to Your Server

1. Open the invite link in your browser
2. Select your Discord server from the dropdown
3. Click **"Authorize"**
4. Complete the CAPTCHA if prompted

#### Step 6: Get Channel ID

1. In Discord, go to **User Settings** (gear icon ⚙️)
2. Go to **"Advanced"** and enable **"Developer Mode"**
3. Navigate to the channel where you want the bot to post activities
4. Right-click on the channel name
5. Select **"Copy Channel ID"**
6. Paste this ID in your `.env` file as `DISCORD_CHANNEL_ID`

### 2. Strava API Setup

#### Step 1: Create Strava API Application

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Log in with your Strava account (create one if you don't have it)
3. Click **"Create App"** button

#### Step 2: Fill Application Details

1. **Application Name**: Enter your bot name (e.g., "Strava Running Bot")
2. **Category**: Select **"Other"**
3. **Club**: Leave blank (unless you have a specific Strava club)
4. **Website**: Enter your website URL or GitHub repository URL
5. **Application Description**: Brief description of your bot
6. **Authorization Callback Domain**:
   - For **development**: `localhost` or `127.0.0.1`
   - For **production**: Your actual domain (e.g., `yourdomain.com`)
   - ⚠️ **Important**: Don't include `http://` or `https://`, just the domain

#### Step 3: Get API Credentials

1. After creating the app, you'll see your application details
2. Copy the **"Client ID"** and paste it in your `.env` file as `STRAVA_CLIENT_ID`
3. Copy the **"Client Secret"** and paste it in your `.env` file as `STRAVA_CLIENT_SECRET`
4. **⚠️ IMPORTANT**: Keep the Client Secret confidential!

#### Step 4: Generate Webhook Verification Token

1. Generate a secure random token for webhook verification:

   ```bash
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```

2. Copy the generated token to your `.env` file as `STRAVA_WEBHOOK_VERIFY_TOKEN`
3. This token ensures that webhook requests are actually coming from Strava

#### Step 5: Note Your Rate Limits

- Strava API has rate limits: **100 requests per 15 minutes**, **1000 requests per day**
- The bot automatically handles these limits with a 20%/10% safety margin and proper throttling

### 3. Environment Configuration

#### Setup Your Environment File

```bash
cp .env.example .env
```

Edit your `.env` file with the credentials obtained from the previous steps. The `.env.example` file contains detailed comments for each variable.

#### Generate Required Keys

```bash
# Generate encryption key (required)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate webhook verification token (if not done already)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> **⚠️ Security**: Never commit your `.env` file to version control. Keep all tokens and keys secure.

### 4. Webhook Setup (Production Only)

**⚠️ Note**: Webhooks are only needed for production deployment. For development, you can test the bot without webhooks.

#### Prerequisites for Webhook Setup

- A **public domain** or server accessible from the internet
- **HTTPS enabled** (Strava requires HTTPS for webhooks)
- Your bot running on that server

#### Step 1: Verify Your Server is Accessible

1. Deploy your bot to your production server
2. Ensure it's running on a public domain with HTTPS
3. Test that `https://yourdomain.com/health` returns a health check response

#### Step 2: Create Webhook Subscription

```bash
# Create webhook subscription (replace with your actual domain)
node utils/setup.js create-webhook https://yourdomain.com/webhook/strava

# This will register your server to receive activity updates from Strava
```

#### Create webhook via Docker (recommended)
Make sure your server at BASE_URL is reachable by Strava (HTTPS) before running these.

- If the container is already running:
  ```bash
  # runs the setup script inside the running container
  docker compose -f docker-compose.yml exec strava-running-bot \
    node utils/setup.js create-webhook https://bot.wazany.fr/webhook/strava
  ```

- If the container is not running (one-off run with compose, uses env_file from compose):
  ```bash
  # runs the setup script in a temporary container (no service startup)
  docker compose -f docker-compose.yml run --rm --no-deps \
    --entrypoint node strava-running-bot \
    utils/setup.js create-webhook https://bot.wazany.fr/webhook/strava
  ```

- Using the built image directly (ensure .env or env vars are provided):
  ```bash
  docker run --rm --env-file .env \
    ghcr.io/your-gh-user/strava-running-bot:latest \
    node utils/setup.js create-webhook https://bot.wazany.fr/webhook/strava
  ```

Notes:
- The script needs correct env vars (STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN, BASE_URL). Provide them via .env, compose env, or docker --env / --env-file.
- Strava will perform a verification request to the callback URL; your app must respond correctly for the webhook to be created.

#### Create webhook via Docker (direct docker exec)
If you prefer not to use docker compose, you can call the setup script directly with docker:

- Find the container (if running):
  ```bash
  docker ps
  ```

- Run the setup script inside an already running container:
  ```bash
  docker exec -it strava-running-bot \
    node utils/setup.js create-webhook https://bot.wazany.fr/webhook/strava
  ```
  - If you need to run as the non-root user created in the image:
    ```bash
    docker exec -u botuser -it strava-running-bot \
      node utils/setup.js create-webhook https://bot.wazany.fr/webhook/strava
    ```

- If the container is not running, run a one‑off container (ensure env vars are provided via --env or --env-file):
  ```bash
  docker run --rm --env-file .env \
    ghcr.io/your-gh-user/strava-running-bot:latest \
    node utils/setup.js create-webhook https://bot.wazany.fr/webhook/strava
  ```

Notes:
- The script requires STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN and BASE_URL to be available inside the container. Using docker exec against a running container inherits its environment. For one‑off runs provide them with --env or --env-file.
- Strava will perform a verification request to the callback URL; ensure your app/endpoint is reachable (HTTPS) and responds correctly.

#### Step 3: Verify Webhook Setup

```bash
# List existing webhooks to confirm creation
node utils/setup.js list-webhooks

# You should see your webhook listed with the callback URL
```

#### Step 4: Test Webhook (Optional)

1. Post a new activity on Strava (or use an existing member's activity)
2. Check your bot's logs to see if the webhook is received
3. Verify the activity appears in your Discord channel

#### Webhook Management Commands

```bash
# List all webhook subscriptions
node utils/setup.js list-webhooks

# Delete a specific webhook (get ID from list command)
node utils/setup.js delete-webhook SUBSCRIPTION_ID

# Validate webhook configuration
node utils/setup.js validate-webhook
```

## 🎮 Discord Commands

### User Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/register` | Register yourself with Strava | `/register` |
| `/last` | Show last activity from a member | `/last member: John` |
| `/toggleprivateactivity` | Toggle your ability to view your private Strava activities | `/toggleprivateactivity` |

> Only you can toggle your own private activities. Admins cannot change this for you.

### Admin Commands (Manage Server Permission Required)

| Command | Description | Usage |
|---------|-------------|-------|
| `/members list` | List all registered team members | `/members list` |
| `/members remove` | Remove a team member | `/members remove user: @user` |
| `/members deactivate` | Temporarily deactivate a member | `/members deactivate user: @user` |
| `/members reactivate` | Reactivate a deactivated member | `/members reactivate user: @user` |
| `/botstatus` | Show bot statistics and health | `/botstatus` |

## 🌐 API Endpoints

### Health & Status

- `GET /health` - Health check endpoint
- `GET /members` - List all registered members (JSON)

### Member Management

- `POST /members/:athleteId/delete` - Remove member by athlete ID
- `POST /members/discord/:discordId/delete` - Remove member by Discord ID
- `POST /members/:athleteId/deactivate` - Deactivate member
- `POST /members/:athleteId/reactivate` - Reactivate member

### Strava Integration

- `GET /webhook/strava` - Webhook verification endpoint
- `POST /webhook/strava` - Webhook event receiver
- `GET /auth/strava` - Start OAuth flow
- `GET /auth/strava/callback` - OAuth callback handler

### Example Usage

```bash
# List all members
curl http://localhost:3000/members

# Remove a member
curl -X POST http://localhost:3000/members/12345678/delete

# Check bot health
curl http://localhost:3000/health
```

## 🏗️ Project Architecture

```text
strava-running-bot/
├── src/
│   ├── discord/
│   │   ├── bot.js              # Discord bot implementation
│   │   └── commands.js         # Slash command handlers
│   ├── strava/
│   │   └── api.js              # Strava API integration
│   ├── server/
│   │   └── webhook.js          # Webhook server & API endpoints
│   ├── processors/
│   │   └── ActivityProcessor.js # Main activity processing logic
│   ├── managers/
│   │   └── MemberManager.js    # Team member management
│   ├── utils/
│   │   ├── ActivityFormatter.js # Activity data formatting
│   │   ├── DiscordUtils.js     # Discord utility functions
│   │   ├── EmbedBuilder.js     # Discord embed creation
│   │   ├── Logger.js           # Logging utilities
│   │   └── RateLimiter.js      # Strava API rate limiting
│   └── index.js                # Application entry point
├── config/
│   └── config.js               # Configuration management
├── utils/
│   └── setup.js                # Setup and management utilities
├── data/                       # Member data storage (encrypted)
├── logs/                       # Application logs
├── .env.example                # Environment variables template
├── 
│   ├── docker-compose.yml      # Docker deployment configuration
│   └── Dockerfile              # Container image definition
└── README.md                   # This documentation
```

### Key Components

#### **ActivityProcessor**

- Central orchestrator for all bot operations
- Handles activity processing pipeline with queuing system
- Manages Discord and Strava integrations
- Coordinates member management and activity filtering
- Processes webhook events with delayed posting

#### **DiscordBot**

- Discord.js v14 client wrapper with full intent support
- Slash command registration and autocomplete handling
- Rich embed generation using modular EmbedBuilder
- Google Maps route visualization integration
- Error handling with graceful client destruction

#### **StravaAPI**

- Complete Strava API wrapper with OAuth2 flow
- Automatic rate limiting (80/15min, 900/day with safety margins)
- Activity data processing with GAP calculations
- Token refresh and authentication management
- Webhook signature verification for security

#### **MemberManager**

- Secure member data storage with AES-256 encryption
- JSON-based persistent storage with atomic writes
- Token management with automatic refresh
- Member lifecycle operations (register/deactivate/remove)
- Discord user mapping and profile integration

#### **WebhookServer**

- Express.js server with comprehensive middleware
- Strava webhook event processing with signature validation
- RESTful member management API endpoints
- OAuth callback handling with HTML responses
- Health monitoring and error handling with proper status codes

#### **Utility Components**

- **RateLimiter**: Strava API compliance with request queuing
- **ActivityFormatter**: Distance, time, and pace calculations
- **EmbedBuilder**: Modular Discord embed creation system
- **DiscordUtils**: User ID parsing and utility functions
- **Logger**: Structured logging with category-based output

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DISCORD_TOKEN` | ✅ | Discord bot token | - |
| `DISCORD_CHANNEL_ID` | ✅ | Target Discord channel ID | - |
| `STRAVA_CLIENT_ID` | ✅ | Strava API client ID | - |
| `STRAVA_CLIENT_SECRET` | ✅ | Strava API client secret | - |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | ✅ | Webhook verification token | - |
| `ENCRYPTION_KEY` | ✅ | 32-byte hex encryption key for member data | - |
| `BASE_URL` | ✅* | Public URL for webhooks (production only) | `http://localhost:3000` |
| `PORT` | ❌ | Server port | `3000` |
| `NODE_ENV` | ❌ | Environment mode | `development` |
| `LOG_LEVEL` | ❌ | Logging level (DEBUG, INFO, WARN, ERROR) | `INFO` |
| `POST_DELAY_MINUTES` | ❌ | Delay before posting activities (minutes) | `15` |
| `GOOGLE_MAPS_API_KEY` | ❌ | Google Maps API key for route visualization | - |

> **Note**: `BASE_URL` is required for production deployments but optional for local development.

### Application Settings

- **Activity Filters**: Automatically filters activities without distance (weight training, etc.) and processes recent activities
- **Rate Limiting**: Conservative Strava API limits (80 requests/15min, 900/day) with request queuing and 20%/10% safety margin
- **Posting Delay**: Configurable delay before posting activities (default: 15 minutes) to allow for activity completion
- **Route Visualization**: Google Maps integration for GPS route display in Discord embeds
- **Token Management**: Automatic OAuth2 token refresh with secure AES-256 encrypted storage
- **Data Persistence**: Atomic JSON file operations with backup and recovery mechanisms
- **Error Handling**: Comprehensive error recovery with graceful degradation and logging

## 🐳 Docker Deployment

### Quick Deploy

```bash
# Start with Docker Compose
docker compose -f docker-compose.yml up -d

# View logs
docker compose -f docker-compose.yml logs -f

# Check status
docker compose -f docker-compose.yml ps
```

### Production deployment (docker-compose.prod.yml) — separate usage
The docker-compose.prod.yml file is optional and intended to run a pre-built image (for example, ghcr.io/<owner>/strava-running-bot:latest) on your server. Benefits:
- No build on the server — faster and reproducible.
- Works well with Watchtower for automatic updates.

When to use it
- You build and push the image from CI (e.g. GitHub Actions → GHCR).
- Your server can pull the image from GHCR (public or authenticated).

Server usage examples
1. Place your `.env` file on the server (do not commit it).
2. Using the image defined in docker-compose.prod.yml:
   - docker compose -f docker-compose.prod.yml pull
   - docker compose -f docker-compose.prod.yml up -d
3. To force a specific image (override):
   - DOCKER_IMAGE="ghcr.io/youruser/strava-running-bot:latest" docker compose -f docker-compose.yml up -d
   (The primary docker-compose.yml supports DOCKER_IMAGE as an override)

Watchtower (automatic updates)
- If Watchtower monitors your GHCR image, it will detect new image tags and pull/restart the container automatically.
- Minimal Watchtower example (run on same host):
  docker run -d --name watchtower \
    -v /var/run/docker.sock:/var/run/docker.sock \
    containrrr/watchtower \
    --cleanup --interval 300 \
    ghcr.io/youruser/strava-running-bot:latest

Security / best practices
- Keep `.env` out of the repository and restrict its permissions.
- If GHCR is private, configure `docker login ghcr.io` on the server for pull authentication.
- Watchtower may need access to credentials for private images.

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Check application health
curl http://localhost:3000/health

# View bot statistics
curl http://localhost:3000/members

# Check Docker health
docker compose -f docker-compose.yml ps
```

### Logs

```bash
# Development
npm run dev

# Docker
docker compose -f docker-compose.yml logs -f

# Specific timeframe
docker compose -f docker-compose.yml logs --since="1h"
```

### Maintenance Tasks

- **Weekly**: Check member token status and activity
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and rotate encryption keys
- **As needed**: Monitor Strava API quota usage

## 🛠 Development

### Project Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests (when implemented)
```

### Setup Utilities

```bash
# Validate configuration
node utils/setup.js validate

# Generate encryption key
node utils/setup.js generate-key

# Manage webhooks (production)
node utils/setup.js list-webhooks
```

### Key Dependencies

- **Node.js** - Latest LTS with improved performance and security
- **Discord.js** - Modern Discord API wrapper with slash commands
- **Express** - Web framework for webhook server and API endpoints
- **chalk** - Enhanced terminal colors with ESM support
- **dotenv** - Improved environment variable management
- **node-cron** - Advanced task scheduling capabilities
- **axios** - HTTP client for API requests
- **nodemon** - Development auto-restart utility

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🔐 Security Considerations

### Data Protection

- **Encryption**: All sensitive member data encrypted with AES-256
- **Token Security**: Secure storage and automatic rotation of API tokens
- **Access Control**: Permission-based Discord command access
- **Input Validation**: Comprehensive input validation and sanitization

### Network Security

- **HTTPS Required**: Production deployment requires HTTPS
- **Webhook Verification**: Strava webhook signature validation
- **Rate Limiting**: API rate limiting and abuse prevention
- **Container Security**: Non-root user and minimal container surface

### Best Practices

- Regular security updates and dependency management
- Secure environment variable management
- Audit logs for administrative actions
- Backup and recovery procedures

## 🐛 Troubleshooting

### Common Issues

#### Bot Not Responding

```bash
# Check bot status
curl http://localhost:3000/health

# View logs
docker compose -f docker-compose.yml logs -f

# Verify Discord permissions
# Check bot invite URL and server permissions
```

#### Member Registration Failing

```bash
# Verify Strava credentials
node utils/setup.js validate

# Check redirect URI configuration
# Ensure domain matches Strava app settings
```

#### Activities Not Posting

```bash
# Check webhook subscription
node utils/setup.js list-webhooks

# Verify member tokens
curl http://localhost:3000/members

# Check webhook logs
docker compose -f docker-compose.yml logs -f | grep webhook
```

#### Token Refresh Errors

```bash
# Check member status
curl http://localhost:3000/members

# Manually refresh if needed
# Members may need to re-authorize
```

#### Webhooks

- **403 Forbidden**: Check that your `STRAVA_WEBHOOK_VERIFY_TOKEN` matches
- **404 Not Found**: Verify your server is running and accessible
- **SSL Certificate Error**: Ensure your domain has valid HTTPS
- **No webhook events**: Check Strava API rate limits and webhook subscription status

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=DEBUG` in your `.env` file.

### Support

For additional support:

1. Check the logs for detailed error messages
2. Verify all configuration settings
3. Test individual components (Discord, Strava, webhooks)
4. Review Strava API quota and rate limits
5. Check network connectivity and firewall settings

## 📚 Additional Resources

- [Strava API Documentation](https://developers.strava.com/docs/reference/)
- [Discord.js Guide](https://discordjs.guide/)
- [Docker Documentation](https://docs.docker.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- **Strava API** for providing comprehensive fitness data access
- **Discord.js** for excellent Discord bot development framework
- **Node.js Community** for robust ecosystem and best practices
- **Running Community** for inspiration and testing

---
**Built with ❤️ for the running community**
For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/your-repo/strava-running-bot).
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- **Strava API** for providing comprehensive fitness data access
- **Discord.js** for excellent Discord bot development framework
- **Node.js Community** for robust ecosystem and best practices
- **Running Community** for inspiration and testing

---
**Built with ❤️ for the running community**
For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/your-repo/strava-running-bot).
