const express = require('express');
const config = require('../../config/config');
const logger = require('../utils/Logger');

class WebhookServer {
  constructor(activityProcessor) {
    this.app = express();
    this.activityProcessor = activityProcessor;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        logger.request(req.method, req.path, res.statusCode, responseTime, req.get('User-Agent'));
      });
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: config.app.name,
        version: config.app.version
      });
    });

    // Strava webhook verification endpoint
    this.app.get('/webhook/strava', this.handleWebhookVerification.bind(this));
    
    // Strava webhook event endpoint
    this.app.post('/webhook/strava', this.handleWebhookEvent.bind(this));

    // OAuth callback endpoint for Strava authentication
    this.app.get('/auth/strava/callback', this.handleStravaCallback.bind(this));

    // Member registration endpoint
    this.app.get('/auth/strava', this.handleStravaAuth.bind(this));

    // Member management endpoints
    this.app.get('/members', this.listMembers.bind(this));
    this.app.post('/members/:athleteId/delete', this.removeMember.bind(this));
    this.app.post('/members/discord/:discordId/delete', this.removeMemberByDiscord.bind(this));
    this.app.post('/members/:athleteId/deactivate', this.deactivateMember.bind(this));
    this.app.post('/members/:athleteId/reactivate', this.reactivateMember.bind(this));

    // Test error routes - only used in tests
    if (process.env.NODE_ENV === 'test') {
      // Regular test error route
      this.app.get('/test-error', () => {
        throw new Error('Test error');
      });

      // Development mode test error route
      this.app.get('/dev-test-error', (req, res, next) => {
        next(new Error('Development Test Error'));
      });
    }

    // Error handler must be registered before the 404 handler
    this.app.use((error, req, res, _next) => {
      // Log all errors
      logger.server.error('Server error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      // Handle JSON parsing errors (SyntaxError from body-parser)
      if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({ 
          error: 'Invalid JSON',
          message: config.server.nodeEnv === 'development' ? error.message : 'Malformed request body'
        });
      }

      // Handle all other errors as 500 Internal Server Error
      res.status(500).json({ 
        error: 'Internal server error',
        message: config.server.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    });

    // 404 handler must come last
    this.app.use('*splat', (req, res) => {
      res.status(404).json({ 
        error: 'Not found',
        path: req.originalUrl 
      });
    });
  }

  // Handle Strava webhook verification challenge
  handleWebhookVerification(req, res) {
    const { 'hub.challenge': challenge, 'hub.verify_token': verifyToken } = req.query;

    logger.webhook.info('Webhook verification request received', {
      verifyToken,
      expectedToken: config.strava.webhookVerifyToken,
      query: req.query
    });

    // Verify the token matches what we set in Strava
    if (verifyToken === config.strava.webhookVerifyToken) {
      logger.webhook.info('Webhook verification successful');
      res.json({ 'hub.challenge': challenge });
    } else {
      logger.webhook.warn('Webhook verification failed - invalid token', {
        receivedToken: verifyToken,
        expectedToken: config.strava.webhookVerifyToken
      });
      res.status(403).json({ error: 'Invalid verify token' });
    }
  }

  // Handle incoming webhook events from Strava
  async handleWebhookEvent(req, res) {
    try {
      const event = req.body;
      
      logger.webhook.info('Webhook event received', event);

      // Process the event synchronously before responding
      await this.processWebhookEvent(event);

      // Acknowledge receipt after successful processing
      res.status(200).json({ received: true });
    } catch (error) {
      logger.webhook.error('Error handling webhook event', {
        error: error.message,
        event: req.body,
        stack: error.stack
      });
      res.status(500).json({ error: 'Failed to process webhook event' });
    }
  }

  // Process different types of webhook events
  async processWebhookEvent(event) {
    const { object_type, aspect_type, object_id, owner_id } = event;

    logger.webhook.info('Processing webhook event', {
      aspectType: aspect_type,
      objectType: object_type,
      objectId: object_id,
      ownerId: owner_id
    });

    // Only process activity events
    if (object_type !== 'activity') {
      logger.webhook.debug('Skipping non-activity event', { objectType: object_type });
      return;
    }

    // Handle different event types
    switch (aspect_type) {
    case 'create':
      await this.handleActivityCreate(object_id, owner_id);
      break;
    case 'update':
      await this.handleActivityUpdate(object_id, owner_id);
      break;
    case 'delete':
      await this.handleActivityDelete(object_id, owner_id);
      break;
    default:
      logger.webhook.debug('Unhandled event type', { aspectType: aspect_type });
    }
  }

  // Handle new activity creation
  async handleActivityCreate(activityId, athleteId) {
    try {
      logger.activity.info('New activity created', {
        activityId,
        athleteId,
        eventType: 'create'
      });
      // Queue activity for delayed posting instead of processing immediately
      await this.activityProcessor.queueActivity(activityId, athleteId, {
        eventType: 'create',
        receivedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.activity.error('Error queueing new activity', {
        activityId,
        athleteId,
        error: error.message
      });
      throw error;
    }
  }

  // Handle activity updates
  async handleActivityUpdate(activityId, athleteId) {
    try {
      logger.activity.info('Activity updated', {
        activityId,
        athleteId,
        eventType: 'update'
      });
      // Update queued activity or queue it if not already queued
      await this.activityProcessor.updateQueuedActivity(activityId, athleteId, {
        eventType: 'update',
        receivedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.activity.error('Error handling activity update', {
        activityId,
        athleteId,
        error: error.message
      });
      throw error;
    }
  }

  // Handle activity deletion
  async handleActivityDelete(activityId, athleteId) {
    logger.activity.info('Activity deleted', {
      activityId,
      athleteId,
      eventType: 'delete'
    });
    // Remove from queue if it was scheduled for posting
    await this.activityProcessor.removeQueuedActivity(activityId, athleteId);
    // Note: In the future, you might want to delete the corresponding Discord message
  }

  // Handle Strava OAuth authorization
  handleStravaAuth(req, res) {
    const { user_id } = req.query; // Discord user ID passed as state
    
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id parameter' });
    }

    const authUrl = this.activityProcessor.stravaAPI.getAuthorizationUrl(user_id);
    res.redirect(authUrl);
  }

  // Handle Strava OAuth callback
  async handleStravaCallback(req, res) {
    try {
      const { code, state, error } = req.query;

      if (error) {
        logger.strava.error('Strava OAuth error', {
          error: error.message,
          code: code,
          state: state
        });
        return res.status(400).json({ error: `Strava authorization failed: ${error}` });
      }

      if (!code) {
        return res.status(400).json({ error: 'Missing authorization code' });
      }

      const discordUserId = state; // Discord user ID from state parameter

      // Exchange code for tokens
      const tokenData = await this.activityProcessor.stravaAPI.exchangeCodeForToken(code);
      
      // Get athlete information
      const athlete = await this.activityProcessor.stravaAPI.getAthlete(tokenData.access_token);

      // Get Discord user information
      let discordUser = null;
      try {
        if (this.activityProcessor.discordBot?.client) {
          discordUser = await this.activityProcessor.discordBot.client.users.fetch(discordUserId);
        }
      } catch (error) {
        logger.discord.warn('Could not fetch Discord user info', {
          discordUserId,
          error: error.message
        });
      }

      // Register the member
      await this.activityProcessor.memberManager.registerMember(
        discordUserId,
        athlete,
        tokenData,
        discordUser
      );

      const displayName = discordUser ? discordUser.displayName || discordUser.username : discordUserId;
      logger.member.info('Member successfully registered', {
        displayName,
        discordUserId,
        stravaName: `${athlete.firstname} ${athlete.lastname}`,
        athleteId: athlete.id
      });

      res.send(`
        <html>
          <head>
            <title>Strava Authorization Complete</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background-color: #f8f9fa;
                margin: 0;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              .strava-logo {
                color: #FC4C02;
                font-weight: bold;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✅ Authorization Successful!</h1>
              <p>Welcome <strong>${athlete.firstname} ${athlete.lastname}</strong>!</p>
              <p>Your Strava account has been successfully linked to the Strava Running Bot.</p>
              <p>You can now close this window and return to Discord.</p>
              <div class="footer">
                <p class="strava-logo">Powered by Strava</p>
                <p>This application uses the Strava API to access your public activities.</p>
              </div>
            </div>
          </body>
        </html>
      `);

    } catch (error) {
      logger.strava.error('Error in Strava callback', {
        error: error.message,
        code: req.query.code,
        state: req.query.state,
        stack: error.stack
      });
      res.status(500).send(`
        <html>
          <head>
            <title>Strava Authorization Failed</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background-color: #f8f9fa;
                margin: 0;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              .strava-logo {
                color: #FC4C02;
                font-weight: bold;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #666;
              }
              .error {
                background-color: #f8d7da;
                color: #721c24;
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Authorization Failed</h1>
              <p>There was an error linking your Strava account.</p>
              <p>Please try again or contact support.</p>
              <div class="error">Error: ${error.message}</div>
              <div class="footer">
                <p class="strava-logo">Powered by Strava</p>
                <p>This application uses the Strava API to access your public activities.</p>
              </div>
            </div>
          </body>
        </html>
      `);
    }
  }

  // List all members
  async listMembers(req, res) {
    try {
      const members = await this.activityProcessor.memberManager.getAllMembers();
      const memberList = members.map(member => ({
        athleteId: member.athlete.id,
        discordUserId: member.discordUserId,
        name: member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`,
        registeredAt: member.registeredAt,
        isActive: member.isActive,
        city: member.athlete.city,
        country: member.athlete.country
      }));

      res.json({
        total: memberList.length,
        members: memberList
      });
    } catch (error) {
      logger.member.error('Error listing members', error);
      res.status(500).json({ error: 'Failed to list members' });
    }
  }

  // Remove member by athlete ID
  async removeMember(req, res) {
    try {
      const { athleteId } = req.params;
      const removedMember = await this.activityProcessor.memberManager.removeMember(athleteId);
      
      if (removedMember) {
        const memberName = removedMember.discordUser 
          ? removedMember.discordUser.displayName 
          : `${removedMember.athlete.firstname} ${removedMember.athlete.lastname}`;
        
        res.json({
          success: true,
          message: `Removed member: ${memberName}`,
          member: {
            athleteId: removedMember.athlete.id,
            name: memberName,
            discordUserId: removedMember.discordUserId
          }
        });
      } else {
        res.status(404).json({ error: 'Member not found' });
      }
    } catch (error) {
      logger.member.error('Error removing member', {
        athleteId: req.params.athleteId,
        error: error.message
      });
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  // Remove member by Discord ID
  async removeMemberByDiscord(req, res) {
    try {
      const { discordId } = req.params;
      const removedMember = await this.activityProcessor.memberManager.removeMemberByDiscordId(discordId);
      
      if (removedMember) {
        const memberName = removedMember.discordUser 
          ? removedMember.discordUser.displayName 
          : `${removedMember.athlete.firstname} ${removedMember.athlete.lastname}`;
        
        res.json({
          success: true,
          message: `Removed member: ${memberName}`,
          member: {
            athleteId: removedMember.athlete.id,
            name: memberName,
            discordUserId: removedMember.discordUserId
          }
        });
      } else {
        res.status(404).json({ error: 'Member not found' });
      }
    } catch (error) {
      logger.member.error('Error removing member by Discord ID', {
        discordId: req.params.discordId,
        error: error.message
      });
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  // Deactivate member
  async deactivateMember(req, res) {
    try {
      const { athleteId } = req.params;
      const success = await this.activityProcessor.memberManager.deactivateMember(athleteId);
      
      if (success) {
        res.json({
          success: true,
          message: `Deactivated member with athlete ID: ${athleteId}`
        });
      } else {
        res.status(404).json({ error: 'Member not found' });
      }
    } catch (error) {
      logger.member.error('Error deactivating member', {
        athleteId: req.params.athleteId,
        error: error.message
      });
      res.status(500).json({ error: 'Failed to deactivate member' });
    }
  }

  // Reactivate member
  async reactivateMember(req, res) {
    try {
      const { athleteId } = req.params;
      const success = await this.activityProcessor.memberManager.reactivateMember(athleteId);
      
      if (success) {
        res.json({
          success: true,
          message: `Reactivated member with athlete ID: ${athleteId}`
        });
      } else {
        res.status(404).json({ error: 'Member not found' });
      }
    } catch (error) {
      logger.member.error('Error reactivating member', {
        athleteId: req.params.athleteId,
        error: error.message
      });
      res.status(500).json({ error: 'Failed to reactivate member' });
    }
  }

  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(config.server.port, () => {
        logger.server.info('Webhook server started', {
          port: config.server.port,
          baseUrl: config.server.baseUrl,
          webhookEndpoint: `${config.server.baseUrl}/webhook/strava`,
          authEndpoint: `${config.server.baseUrl}/auth/strava`
        });
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.server.info('Webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = WebhookServer;