const request = require('supertest');
const WebhookServer = require('../../src/server/webhook');
const config = require('../../config/config');
const logger = require('../../src/utils/Logger');

// Mock dependencies
jest.mock('../../config/config', () => ({
  app: {
    name: 'Strava Running Bot',
    version: '1.0.0'
  },
  server: {
    port: 3000,
    baseUrl: 'https://test.example.com',
    nodeEnv: 'test'
  },
  strava: {
    webhookVerifyToken: 'test_webhook_token'
  }
}));

jest.mock('../../src/utils/Logger', () => ({
  request: jest.fn(),
  webhook: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  server: {
    info: jest.fn(),
    error: jest.fn()
  },
  strava: {
    error: jest.fn()
  },
  discord: {
    warn: jest.fn()
  },
  activity: {
    info: jest.fn(),
    error: jest.fn()
  },
  member: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('WebhookServer', () => {
  let webhookServer;
  let mockActivityProcessor;
  let app;

  const mockMember = {
    discordUserId: '123456789',
    athlete: {
      id: 12345,
      firstname: 'John',
      lastname: 'Doe'
    },
    tokens: {
      access_token: 'test_token',
      refresh_token: 'test_refresh_token'
    },
    discordUser: {
      displayName: 'Test User'
    }
  };

  const mockAthlete = {
    id: 12345,
    firstname: 'John',
    lastname: 'Doe'
  };

  const mockTokenData = {
    access_token: 'new_access_token',
    refresh_token: 'new_refresh_token',
    expires_at: Math.floor(Date.now() / 1000) + 3600
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Override Express's error handling behavior for this test
    const express = require('express');
    const originalUse = express.application.use;
    express.application.use = function(path, handler) {
      // Add error route before 404 handler
      if (path === '*') {
        this.get('/error', (req, res, next) => next(new Error('Test error')));
      }
      return originalUse.apply(this, arguments);
    };

    // Mock ActivityProcessor and its dependencies
    mockActivityProcessor = {
      queueActivity: jest.fn().mockResolvedValue(),
      updateQueuedActivity: jest.fn().mockResolvedValue(),
      removeQueuedActivity: jest.fn().mockResolvedValue(),
      stravaAPI: {
        getAuthorizationUrl: jest.fn().mockReturnValue('https://strava.com/oauth/authorize?test=1'),
        exchangeCodeForToken: jest.fn().mockResolvedValue(mockTokenData),
        getAthlete: jest.fn().mockResolvedValue(mockAthlete)
      },
      memberManager: {
        registerMember: jest.fn().mockResolvedValue(mockMember),
        getAllMembers: jest.fn().mockResolvedValue([mockMember]),
        removeMember: jest.fn().mockResolvedValue(mockMember),
        removeMemberByDiscordId: jest.fn().mockResolvedValue(mockMember),
        deactivateMember: jest.fn().mockResolvedValue(true),
        reactivateMember: jest.fn().mockResolvedValue(true)
      },
      discordBot: {
        client: {
          users: {
            fetch: jest.fn().mockResolvedValue({
              displayName: 'Test User',
              username: 'testuser'
            })
          }
        }
      }
    };

    webhookServer = new WebhookServer(mockActivityProcessor);
    app = webhookServer.app;
  });

  describe('constructor', () => {
    it('should initialize Express app with activity processor', () => {
      expect(webhookServer.app).toBeDefined();
      expect(webhookServer.activityProcessor).toBe(mockActivityProcessor);
    });
  });

  describe('middleware setup', () => {
    it('should parse JSON bodies', async () => {
      // Send a valid Strava webhook event to trigger queueActivity
      const testData = {
        object_type: 'activity',
        object_id: 1,
        aspect_type: 'create',
        owner_id: 2
      };

      await request(app)
        .post('/webhook/strava')
        .send(testData)
        .expect(200);

      // Verify the body was parsed (webhook handler should receive the JSON)
      expect(mockActivityProcessor.queueActivity).toHaveBeenCalled();
    });

    it('should log requests with timing', async () => {
      await request(app)
        .get('/health')
        .set('User-Agent', 'jest-test-agent')
        .expect(200);

      expect(logger.request).toHaveBeenCalledWith(
        'GET',
        '/health',
        200,
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('health endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        service: config.app.name,
        version: config.app.version
      });
    });
  });

  describe('webhook verification endpoint', () => {
    it('should handle successful webhook verification', async () => {
      const challenge = 'test_challenge_123';
      const verifyToken = config.strava.webhookVerifyToken;

      const response = await request(app)
        .get('/webhook/strava')
        .query({
          'hub.challenge': challenge,
          'hub.verify_token': verifyToken
        })
        .expect(200);

      expect(response.body).toEqual({ 'hub.challenge': challenge });
      expect(logger.webhook.info).toHaveBeenCalledWith('Webhook verification successful');
    });

    it('should reject invalid verification token', async () => {
      const challenge = 'test_challenge_123';
      const invalidToken = 'invalid_token';

      const response = await request(app)
        .get('/webhook/strava')
        .query({
          'hub.challenge': challenge,
          'hub.verify_token': invalidToken
        })
        .expect(403);

      expect(response.body).toEqual({ error: 'Invalid verify token' });
      expect(logger.webhook.warn).toHaveBeenCalledWith(
        'Webhook verification failed - invalid token',
        expect.any(Object)
      );
    });

    it('should log verification request details', async () => {
      const challenge = 'test_challenge_123';
      const verifyToken = config.strava.webhookVerifyToken;

      await request(app)
        .get('/webhook/strava')
        .query({
          'hub.challenge': challenge,
          'hub.verify_token': verifyToken
        });

      expect(logger.webhook.info).toHaveBeenCalledWith(
        'Webhook verification request received',
        expect.objectContaining({
          verifyToken,
          expectedToken: config.strava.webhookVerifyToken
        })
      );
    });
  });

  describe('webhook event endpoint', () => {
    const validEvent = {
      object_type: 'activity',
      object_id: 12345,
      aspect_type: 'create',
      owner_id: 67890
    };

    it('should process activity create events', async () => {
      const response = await request(app)
        .post('/webhook/strava')
        .send(validEvent)
        .expect(200);

      expect(response.body).toEqual({ received: true });
      expect(logger.webhook.info).toHaveBeenCalledWith('Webhook event received', validEvent);
      expect(mockActivityProcessor.queueActivity).toHaveBeenCalledWith(
        validEvent.object_id,
        validEvent.owner_id,
        expect.objectContaining({
          eventType: 'create',
          receivedAt: expect.any(String)
        })
      );
    });

    it('should process activity update events', async () => {
      const updateEvent = { ...validEvent, aspect_type: 'update' };

      await request(app)
        .post('/webhook/strava')
        .send(updateEvent)
        .expect(200);

      expect(mockActivityProcessor.updateQueuedActivity).toHaveBeenCalledWith(
        updateEvent.object_id,
        updateEvent.owner_id,
        expect.objectContaining({
          eventType: 'update',
          receivedAt: expect.any(String)
        })
      );
    });

    it('should process activity delete events', async () => {
      const deleteEvent = { ...validEvent, aspect_type: 'delete' };

      await request(app)
        .post('/webhook/strava')
        .send(deleteEvent)
        .expect(200);

      expect(mockActivityProcessor.removeQueuedActivity).toHaveBeenCalledWith(
        deleteEvent.object_id,
        deleteEvent.owner_id
      );
    });

    it('should ignore non-activity events', async () => {
      const nonActivityEvent = { ...validEvent, object_type: 'athlete' };

      await request(app)
        .post('/webhook/strava')
        .send(nonActivityEvent)
        .expect(200);

      expect(logger.webhook.debug).toHaveBeenCalledWith(
        'Skipping non-activity event',
        { objectType: 'athlete' }
      );
      expect(mockActivityProcessor.queueActivity).not.toHaveBeenCalled();
    });

    it('should handle unknown event types', async () => {
      const unknownEvent = { ...validEvent, aspect_type: 'unknown' };

      await request(app)
        .post('/webhook/strava')
        .send(unknownEvent)
        .expect(200);

      expect(logger.webhook.debug).toHaveBeenCalledWith(
        'Unhandled event type',
        { aspectType: 'unknown' }
      );
    });

    it('should handle webhook processing errors gracefully', async () => {
      const error = new Error('Processing failed');
      mockActivityProcessor.queueActivity.mockRejectedValue(error);

      const response = await request(app)
        .post('/webhook/strava')
        .send(validEvent)
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to process webhook event' });
      expect(logger.webhook.error).toHaveBeenCalledWith(
        'Error handling webhook event',
        expect.objectContaining({
          error: error.message,
          event: validEvent
        })
      );
    });

    it('should handle activity create errors', async () => {
      const error = new Error('Queue failed');
      mockActivityProcessor.queueActivity.mockRejectedValue(error);

      await request(app)
        .post('/webhook/strava')
        .send(validEvent)
        .expect(500);

      expect(logger.activity.error).toHaveBeenCalledWith(
        'Error queueing new activity',
        expect.objectContaining({
          activityId: validEvent.object_id,
          athleteId: validEvent.owner_id,
          error: error.message
        })
      );
    });

    it('should handle activity update errors', async () => {
      const updateEvent = { ...validEvent, aspect_type: 'update' };
      const error = new Error('Update failed');
      mockActivityProcessor.updateQueuedActivity.mockRejectedValue(error);

      await request(app)
        .post('/webhook/strava')
        .send(updateEvent)
        .expect(500);

      expect(logger.activity.error).toHaveBeenCalledWith(
        'Error handling activity update',
        expect.objectContaining({
          activityId: updateEvent.object_id,
          athleteId: updateEvent.owner_id,
          error: error.message
        })
      );
    });
  });

  describe('OAuth endpoints', () => {
    describe('Strava auth initiation', () => {
      it('should redirect to Strava authorization URL', async () => {
        const userId = '123456789';
        const expectedUrl = 'https://strava.com/oauth/authorize?test=1';

        const response = await request(app)
          .get('/auth/strava')
          .query({ user_id: userId })
          .expect(302);

        expect(response.headers.location).toBe(expectedUrl);
        expect(mockActivityProcessor.stravaAPI.getAuthorizationUrl).toHaveBeenCalledWith(userId);
      });

      it('should reject requests without user_id', async () => {
        const response = await request(app)
          .get('/auth/strava')
          .expect(400);

        expect(response.body).toEqual({ error: 'Missing user_id parameter' });
      });
    });

    describe('Strava OAuth callback', () => {
      const validCallbackParams = {
        code: 'auth_code_123',
        state: '123456789' // Discord user ID
      };

      it('should handle successful OAuth callback', async () => {
        const response = await request(app)
          .get('/auth/strava/callback')
          .query(validCallbackParams)
          .expect(200);

        expect(response.text).toContain('Authorization Successful!');
        expect(response.text).toContain('John Doe');
        expect(mockActivityProcessor.stravaAPI.exchangeCodeForToken).toHaveBeenCalledWith('auth_code_123');
        expect(mockActivityProcessor.stravaAPI.getAthlete).toHaveBeenCalledWith(mockTokenData.access_token);
        expect(mockActivityProcessor.memberManager.registerMember).toHaveBeenCalledWith(
          '123456789',
          mockAthlete,
          mockTokenData,
          expect.any(Object)
        );
      });

      it('should handle OAuth callback with error parameter', async () => {
        const response = await request(app)
          .get('/auth/strava/callback')
          .query({ error: 'access_denied', state: '123456789' })
          .expect(400);

        expect(response.body).toEqual({ error: 'Strava authorization failed: access_denied' });
        expect(logger.strava.error).toHaveBeenCalled();
      });

      it('should handle missing authorization code', async () => {
        const response = await request(app)
          .get('/auth/strava/callback')
          .query({ state: '123456789' })
          .expect(400);

        expect(response.body).toEqual({ error: 'Missing authorization code' });
      });

      it('should handle token exchange failure', async () => {
        const error = new Error('Invalid authorization code');
        mockActivityProcessor.stravaAPI.exchangeCodeForToken.mockRejectedValue(error);

        const response = await request(app)
          .get('/auth/strava/callback')
          .query(validCallbackParams)
          .expect(500);

        expect(response.text).toContain('Authorization Failed');
        expect(response.text).toContain(error.message);
        expect(logger.strava.error).toHaveBeenCalledWith(
          'Error in Strava callback',
          expect.objectContaining({ error: error.message })
        );
      });

      it('should handle Discord user fetch failure gracefully', async () => {
        const error = new Error('Discord API error');
        mockActivityProcessor.discordBot.client.users.fetch.mockRejectedValue(error);

        const response = await request(app)
          .get('/auth/strava/callback')
          .query(validCallbackParams)
          .expect(200);

        expect(response.text).toContain('Authorization Successful!');
        expect(logger.discord.warn).toHaveBeenCalledWith(
          'Could not fetch Discord user info',
          expect.objectContaining({
            discordUserId: '123456789',
            error: error.message
          })
        );
      });

      it('should handle missing Discord bot client', async () => {
        mockActivityProcessor.discordBot = null;

        const response = await request(app)
          .get('/auth/strava/callback')
          .query(validCallbackParams)
          .expect(200);

        expect(response.text).toContain('Authorization Successful!');
        // Should still complete registration without Discord user info
        expect(mockActivityProcessor.memberManager.registerMember).toHaveBeenCalledWith(
          '123456789',
          mockAthlete,
          mockTokenData,
          null
        );
      });
    });
  });

  describe('member management endpoints', () => {
    describe('list members', () => {
      it('should return all members list', async () => {
        const response = await request(app)
          .get('/members')
          .expect(200);

        expect(response.body).toEqual({
          total: 1,
          members: [{
            athleteId: mockMember.athlete.id,
            discordUserId: mockMember.discordUserId,
            name: mockMember.discordUser.displayName
          }]
        });
        expect(mockActivityProcessor.memberManager.getAllMembers).toHaveBeenCalled();
      });

      it('should handle member listing errors', async () => {
        const error = new Error('Database error');
        mockActivityProcessor.memberManager.getAllMembers.mockRejectedValue(error);

        const response = await request(app)
          .get('/members')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to list members' });
        expect(logger.member.error).toHaveBeenCalledWith('Error listing members', error);
      });
    });

    describe('remove member by athlete ID', () => {
      it('should remove member successfully', async () => {
        const response = await request(app)
          .post('/members/12345/delete')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: `Removed member: ${mockMember.discordUser.displayName}`,
          member: {
            athleteId: mockMember.athlete.id,
            name: mockMember.discordUser.displayName,
            discordUserId: mockMember.discordUserId
          }
        });
        expect(mockActivityProcessor.memberManager.removeMember).toHaveBeenCalledWith('12345');
      });

      it('should handle member not found', async () => {
        mockActivityProcessor.memberManager.removeMember.mockResolvedValue(null);

        const response = await request(app)
          .post('/members/99999/delete')
          .expect(404);

        expect(response.body).toEqual({ error: 'Member not found' });
      });

      it('should handle removal errors', async () => {
        const error = new Error('Removal failed');
        mockActivityProcessor.memberManager.removeMember.mockRejectedValue(error);

        const response = await request(app)
          .post('/members/12345/delete')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to remove member' });
        expect(logger.member.error).toHaveBeenCalledWith(
          'Error removing member',
          expect.objectContaining({ athleteId: '12345' })
        );
      });
    });

    describe('remove member by Discord ID', () => {
      it('should remove member by Discord ID successfully', async () => {
        const response = await request(app)
          .post('/members/discord/123456789/delete')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockActivityProcessor.memberManager.removeMemberByDiscordId).toHaveBeenCalledWith('123456789');
      });

      it('should handle Discord member not found', async () => {
        mockActivityProcessor.memberManager.removeMemberByDiscordId.mockResolvedValue(null);

        const response = await request(app)
          .post('/members/discord/999999999/delete')
          .expect(404);

        expect(response.body).toEqual({ error: 'Member not found' });
      });
    });

    describe('deactivate member', () => {
      it('should deactivate member successfully', async () => {
        const response = await request(app)
          .post('/members/12345/deactivate')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Deactivated member with athlete ID: 12345'
        });
        expect(mockActivityProcessor.memberManager.deactivateMember).toHaveBeenCalledWith('12345');
      });

      it('should handle member not found for deactivation', async () => {
        mockActivityProcessor.memberManager.deactivateMember.mockResolvedValue(false);

        const response = await request(app)
          .post('/members/99999/deactivate')
          .expect(404);

        expect(response.body).toEqual({ error: 'Member not found' });
      });

      it('should handle deactivation errors', async () => {
        const error = new Error('Deactivation failed');
        mockActivityProcessor.memberManager.deactivateMember.mockRejectedValue(error);

        const response = await request(app)
          .post('/members/12345/deactivate')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to deactivate member' });
      });
    });

    describe('reactivate member', () => {
      it('should reactivate member successfully', async () => {
        const response = await request(app)
          .post('/members/12345/reactivate')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Reactivated member with athlete ID: 12345'
        });
        expect(mockActivityProcessor.memberManager.reactivateMember).toHaveBeenCalledWith('12345');
      });

      it('should handle member not found for reactivation', async () => {
        mockActivityProcessor.memberManager.reactivateMember.mockResolvedValue(false);

        const response = await request(app)
          .post('/members/99999/reactivate')
          .expect(404);

        expect(response.body).toEqual({ error: 'Member not found' });
      });
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown/route')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not found',
        path: '/unknown/route'
      });
    });
  });

  describe('error handler', () => {
    beforeEach(() => {
      // Create a fresh server instance for each test
      webhookServer = new WebhookServer(mockActivityProcessor);
      
      // Add test route that throws an error
      webhookServer.app.get('/test-error', (req, res, next) => {
        next(new Error('Test error'));
      });
      
      // Setup middleware and routes after adding test routes
      webhookServer.setupMiddleware();
      webhookServer.setupRoutes();
      
      // Update the app reference
      app = webhookServer.app;
    });

    it('should handle server errors', async () => {
      // Force an error by causing JSON parsing to fail
      const response = await request(app)
        .post('/webhook/strava')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // This tests the express built-in error handling for malformed JSON
      expect(response.body).toHaveProperty('error');
    });

    it('should log server errors', async () => {
      const response = await request(app)
        .get('/test-error')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
      expect(logger.server.error).toHaveBeenCalledWith(
        'Server error',
        expect.objectContaining({
          error: 'Test error',
          url: '/test-error',
          method: 'GET'
        })
      );
    });

    it('should show error details in development mode', async () => {
      // Save original env and set to development
      const originalNodeEnv = config.server.nodeEnv;
      config.server.nodeEnv = 'development';

      try {
        const response = await request(app)
          .get('/dev-test-error')
          .expect(500);

        // In development mode, we should see the actual error message
        expect(response.body).toEqual({
          error: 'Internal server error',
          message: 'Development Test Error'
        });
      } finally {
        config.server.nodeEnv = originalNodeEnv;
      }
    });
  });

  describe('server lifecycle', () => {
    it('should start server on specified port', async () => {
      const mockListen = jest.fn((port, callback) => {
        callback();
        return { close: jest.fn() };
      });
      webhookServer.app.listen = mockListen;

      await webhookServer.start();

      expect(mockListen).toHaveBeenCalledWith(config.server.port, expect.any(Function));
      expect(logger.server.info).toHaveBeenCalledWith(
        'Webhook server started',
        expect.objectContaining({
          port: config.server.port,
          baseUrl: config.server.baseUrl
        })
      );
    });

    it('should stop server gracefully', async () => {
      const mockClose = jest.fn((callback) => callback());
      webhookServer.server = { close: mockClose };

      await webhookServer.stop();

      expect(mockClose).toHaveBeenCalledWith(expect.any(Function));
      expect(logger.server.info).toHaveBeenCalledWith('Webhook server stopped');
    });

    it('should handle stop when server is not running', async () => {
      webhookServer.server = null;

      const stopPromise = webhookServer.stop();

      // Should resolve successfully without throwing
      await expect(stopPromise).resolves.toBeUndefined();
      
      // Should not log server stopped message when no server exists
      expect(logger.server.info).not.toHaveBeenCalledWith('Webhook server stopped');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete member registration flow', async () => {
      // 1. User requests registration
      const authResponse = await request(app)
        .get('/auth/strava')
        .query({ user_id: '123456789' })
        .expect(302);

      expect(authResponse.headers.location).toBe('https://strava.com/oauth/authorize?test=1');

      // 2. OAuth callback completes registration
      const callbackResponse = await request(app)
        .get('/auth/strava/callback')
        .query({ code: 'auth_code_123', state: '123456789' })
        .expect(200);

      expect(callbackResponse.text).toContain('Authorization Successful!');

      // 3. Verify member is listed
      const membersResponse = await request(app)
        .get('/members')
        .expect(200);

      expect(membersResponse.body.total).toBe(1);
      expect(membersResponse.body.members[0].discordUserId).toBe('123456789');
    });

    it('should handle webhook event processing flow', async () => {
      const event = {
        object_type: 'activity',
        object_id: 54321,
        aspect_type: 'create',
        owner_id: 12345
      };

      // Process webhook event
      await request(app)
        .post('/webhook/strava')
        .send(event)
        .expect(200);

      expect(mockActivityProcessor.queueActivity).toHaveBeenCalledWith(
        54321,
        12345,
        expect.objectContaining({ eventType: 'create' })
      );

      // Verify event was logged
      expect(logger.webhook.info).toHaveBeenCalledWith('Webhook event received', event);
      expect(logger.activity.info).toHaveBeenCalledWith(
        'New activity created',
        expect.objectContaining({
          activityId: 54321,
          athleteId: 12345,
          eventType: 'create'
        })
      );
    });
  });
});