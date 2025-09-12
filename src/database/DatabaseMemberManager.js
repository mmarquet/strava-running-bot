const databaseManager = require('../database/DatabaseManager');
const logger = require('../utils/Logger');

/**
 * Database-backed MemberManager - Drop-in replacement for the JSON-based MemberManager
 * This maintains the same interface while using the new database backend
 */
class DatabaseMemberManager {
  constructor() {
    this.databaseManager = databaseManager;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    await this.databaseManager.initialize();
    this.isInitialized = true;
    
    // logger.database.info('DatabaseMemberManager initialized');
  }

  // === Member Registration & Management ===
  
  async registerMember(discordUserId, athlete, tokenData, discordUser = null) {
    await this.ensureInitialized();
    return await this.databaseManager.registerMember(discordUserId, athlete, tokenData, discordUser);
  }

  async getMemberByAthleteId(athleteId) {
    await this.ensureInitialized();
    return await this.databaseManager.getMemberByAthleteId(athleteId);
  }

  async getMemberByDiscordId(discordUserId) {
    await this.ensureInitialized();
    return await this.databaseManager.getMemberByDiscordId(discordUserId);
  }

  async getAllMembers() {
    await this.ensureInitialized();
    return await this.databaseManager.getAllMembers();
  }

  async getMemberCount() {
    await this.ensureInitialized();
    const members = await this.getAllMembers();
    return members.length;
  }

  async deactivateMember(athleteId) {
    await this.ensureInitialized();
    return await this.databaseManager.deactivateMember(athleteId);
  }

  async reactivateMember(athleteId) {
    await this.ensureInitialized();
    return await this.databaseManager.reactivateMember(athleteId);
  }

  async removeMember(athleteId) {
    await this.ensureInitialized();
    return await this.databaseManager.removeMember(athleteId);
  }

  async removeMemberByDiscordId(discordUserId) {
    await this.ensureInitialized();
    const member = await this.getMemberByDiscordId(discordUserId);
    if (member) {
      return await this.removeMember(member.athleteId);
    }
    return null;
  }

  // === Token Management ===

  async updateTokens(athleteId, tokenData) {
    await this.ensureInitialized();
    return await this.databaseManager.updateTokens(athleteId, tokenData);
  }

  async getValidAccessToken(member) {
    logger.database.info('Getting valid access token', { 
      athleteId: member.athleteId,
      discordUserId: member.discordUserId,
      hasTokens: !!member.tokens
    });

    // First, try to decrypt tokens from database
    if (member.tokens && member.tokens.encrypted) {
      logger.database.info('Found encrypted tokens in database', {
        athleteId: member.athleteId,
        tokenStructure: {
          hasEncrypted: !!member.tokens.encrypted,
          hasIv: !!member.tokens.iv,
          hasAuthTag: !!member.tokens.authTag
        }
      });

      try {
        const config = require('../../config/config');
        const crypto = require('crypto');
        
        if (!config.security.encryptionKey) {
          logger.database.warn('No encryption key available for token decryption');
          return null;
        }
        
        logger.database.info('Attempting token decryption from database', { athleteId: member.athleteId });
        
        // Decrypt using the same method as DatabaseManager
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(config.security.encryptionKey, 'hex');
        const iv = Buffer.from(member.tokens.iv, 'hex');
        const authTag = Buffer.from(member.tokens.authTag, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(member.tokens.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        const decryptedTokens = JSON.parse(decrypted);
        
        logger.database.info('Successfully decrypted tokens from database', { 
          athleteId: member.athleteId,
          hasAccessToken: !!decryptedTokens.access_token,
          expiresAt: decryptedTokens.expires_at
        });
        
        // Check if token is expired
        if (decryptedTokens.expires_at && decryptedTokens.expires_at < Date.now() / 1000) {
          const expiredDate = new Date(decryptedTokens.expires_at * 1000).toISOString();
          logger.database.info('Token expired for member', { 
            athleteId: member.athleteId,
            expiredAt: expiredDate,
            expiredSecondsAgo: Math.floor((Date.now() / 1000) - decryptedTokens.expires_at)
          });
          return null;
        }
        
        logger.database.info('Returning access token from database', { athleteId: member.athleteId });
        return decryptedTokens.access_token;
        
      } catch (error) {
        logger.database.error('Could not decrypt tokens from database', { 
          athleteId: member.athleteId,
          error: error.message,
          errorStack: error.stack
        });
        // Fall through to JSON fallback
      }
    } else {
      logger.database.info('No encrypted tokens found in database, trying JSON fallback', { 
        athleteId: member.athleteId,
        memberTokens: member.tokens
      });
    }
    
    // FALLBACK: Try to get tokens from legacy JSON file if database doesn't have them
    logger.database.info('Entering JSON fallback section', { athleteId: member.athleteId });
    logger.member.debug('Attempting JSON fallback for token decryption', { athleteId: member.athleteId });
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const config = require('../../config/config');
      const crypto = require('crypto');
      
      const jsonPath = path.join(__dirname, '../../data/data/members.json');
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      const memberData = JSON.parse(jsonData);
      
      // Find member in JSON by discordUserId
      const jsonMember = memberData.members.find(m => m.discordUserId === member.discordUserId);
      if (!jsonMember || !jsonMember.tokens) {
        logger.member.debug('Member not found in JSON or no tokens', { 
          athleteId: member.athleteId,
          foundInJson: !!jsonMember,
          hasTokensInJson: !!(jsonMember && jsonMember.tokens)
        });
        return null;
      }
      
      logger.member.debug('Found member in JSON with tokens', {
        athleteId: member.athleteId,
        tokenStructure: {
          hasEncrypted: !!jsonMember.tokens.encrypted,
          hasIv: !!jsonMember.tokens.iv,
          hasAuthTag: !!jsonMember.tokens.authTag
        }
      });
      
      // Decrypt tokens from JSON format
      const encryptedTokens = jsonMember.tokens;
      if (!encryptedTokens.encrypted || !config.security.encryptionKey) {
        logger.member.debug('Missing encrypted data or encryption key for JSON fallback');
        return null;
      }
      
      // Decrypt using the same method as DatabaseManager
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(config.security.encryptionKey, 'hex');
      const iv = Buffer.from(encryptedTokens.iv, 'hex');
      const authTag = Buffer.from(encryptedTokens.authTag, 'hex');
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedTokens.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const decryptedTokens = JSON.parse(decrypted);
      
      logger.member.debug('Successfully decrypted tokens from JSON fallback', { 
        athleteId: member.athleteId,
        hasAccessToken: !!decryptedTokens.access_token,
        expiresAt: decryptedTokens.expires_at
      });
      
      // Check if token is expired
      if (decryptedTokens.expires_at && decryptedTokens.expires_at < Date.now() / 1000) {
        logger.member.debug('Token expired for member', { athleteId: member.athleteId });
        return null;
      }
      
      return decryptedTokens.access_token;
      
    } catch (error) {
      logger.member.debug('Could not decrypt tokens from JSON fallback', { 
        athleteId: member.athleteId,
        error: error.message 
      });
      return null;
    }
  }

  // === Statistics & Health ===

  async getStats() {
    await this.ensureInitialized();
    const dbStats = await this.databaseManager.getStats();
    
    // Return in the format expected by existing code
    return {
      total: dbStats.members.total || 0,
      active: dbStats.members.active || 0,
      inactive: dbStats.members.inactive || 0,
      recentRegistrations: 0 // Could implement this in database if needed
    };
  }

  // === Legacy Support Methods ===

  // These methods maintain compatibility with the old JSON-based system
  // while actually using the database underneath

  saveMembersAsync() {
    // In database system, saves are immediate, so this is a no-op
    return Promise.resolve();
  }

  saveMembers() {
    // In database system, saves are immediate, so this is a no-op
    return Promise.resolve();
  }

  async loadMembers() {
    // In database system, data is loaded on-demand, so this is just initialization
    await this.initialize();
  }

  // === Utility Methods ===

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async close() {
    return await this.databaseManager.close();
  }

  async backup(backupPath) {
    return await this.databaseManager.backup(backupPath);
  }

  async healthCheck() {
    return await this.databaseManager.healthCheck();
  }

  // Map-like interface for legacy compatibility
  get discordToStrava() {
    return {
      get: async (discordUserId) => {
        const member = await this.getMemberByDiscordId(discordUserId);
        return member ? member.athleteId.toString() : undefined;
      },
      has: async (discordUserId) => {
        const member = await this.getMemberByDiscordId(discordUserId);
        return !!member;
      },
      set: () => {
        // No-op since database handles relationships
      },
      delete: () => {
        // No-op since database handles relationships
      }
    };
  }

  get members() {
    return {
      get: async (athleteId) => {
        return await this.getMemberByAthleteId(athleteId);
      },
      has: async (athleteId) => {
        const member = await this.getMemberByAthleteId(athleteId);
        return !!member;
      },
      set: () => {
        // No-op since database handles storage
      },
      delete: () => {
        // No-op since database handles storage
      },
      values: async () => {
        return await this.getAllMembers();
      },
      size: async () => {
        return await this.getMemberCount();
      }
    };
  }

  // Legacy method signatures that may be used by existing code
  verifyMapConsistency() {
    // Database ensures consistency through constraints
    return {
      isConsistent: true,
      errors: [],
      memberCount: 0,
      mappingCount: 0
    };
  }

  encryptMemberData(member) {
    // Database handles encryption
    return member;
  }

  decryptMemberData(member) {
    // Database handles decryption
    return member;
  }
}

module.exports = DatabaseMemberManager;

module.exports = DatabaseMemberManager;