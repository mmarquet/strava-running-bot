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

  // Helper: Decrypt tokens using AES-256-GCM
  _decryptTokenData(encryptedTokens, athleteId) {
    const config = require('../../config/config');
    const crypto = require('node:crypto');
    
    if (!config.security.encryptionKey) {
      logger.database.warn('No encryption key available for token decryption');
      return null;
    }
    
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(config.security.encryptionKey, 'hex');
    const iv = Buffer.from(encryptedTokens.iv, 'hex');
    const authTag = Buffer.from(encryptedTokens.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedTokens.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const decryptedTokens = JSON.parse(decrypted);
    
    // Check if token is expired
    if (decryptedTokens.expires_at && decryptedTokens.expires_at < Date.now() / 1000) {
      logger.database.info('Token expired for member', { athleteId });
      return null;
    }
    
    return decryptedTokens.access_token;
  }

  // Helper: Try to get tokens from database
  async _getTokensFromDatabase(member) {
    if (!member.tokens?.encrypted) {
      return null;
    }

    logger.database.info('Found encrypted tokens in database', {
      athleteId: member.athleteId
    });

    try {
      logger.database.info('Attempting token decryption from database', { athleteId: member.athleteId });
      const accessToken = this._decryptTokenData(member.tokens, member.athleteId);
      
      if (accessToken) {
        logger.database.info('Successfully retrieved access token from database', { athleteId: member.athleteId });
      }
      
      return accessToken;
    } catch (error) {
      logger.database.error('Could not decrypt tokens from database', { 
        athleteId: member.athleteId,
        error: error.message
      });
      return null;
    }
  }

  // Helper: Try to get tokens from JSON fallback
  async _getTokensFromJsonFallback(member) {
    logger.database.info('Trying JSON fallback for tokens', { athleteId: member.athleteId });
    
    try {
      const fs = require('node:fs').promises;
      const path = require('node:path');
      
      const jsonPath = path.join(__dirname, '../../data/data/members.json');
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      const memberData = JSON.parse(jsonData);
      
      const jsonMember = memberData.members.find(m => m.discordUserId === member.discordUserId);
      if (!jsonMember?.tokens) {
        logger.member.debug('Member not found in JSON or no tokens', { athleteId: member.athleteId });
        return null;
      }
      
      logger.member.debug('Found member in JSON with tokens', { athleteId: member.athleteId });
      
      const accessToken = this._decryptTokenData(jsonMember.tokens, member.athleteId);
      
      if (accessToken) {
        logger.member.debug('Successfully retrieved access token from JSON fallback', { athleteId: member.athleteId });
      }
      
      return accessToken;
    } catch (error) {
      logger.member.debug('Could not decrypt tokens from JSON fallback', { 
        athleteId: member.athleteId,
        error: error.message 
      });
      return null;
    }
  }

  async getValidAccessToken(member) {
    logger.database.info('Getting valid access token', { 
      athleteId: member.athleteId,
      discordUserId: member.discordUserId,
      hasTokens: !!member.tokens
    });

    // First, try to decrypt tokens from database
    const dbToken = await this._getTokensFromDatabase(member);
    if (dbToken) {
      return dbToken;
    }

    // Fallback: Try to get tokens from legacy JSON file
    logger.database.info('No valid tokens in database, trying JSON fallback', { athleteId: member.athleteId });
    const jsonToken = await this._getTokensFromJsonFallback(member);
    
    return jsonToken;
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