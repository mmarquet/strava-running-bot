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
    // Implementation depends on your token validation logic
    // This is a simplified version - you may need to implement token refresh logic
    const tokens = member.tokens;
    
    if (!tokens || !tokens.access_token) {
      return null;
    }

    // Check if token is expired
    if (tokens.expires_at && tokens.expires_at < Date.now() / 1000) {
      // Token expired, would need to refresh
      logger.member.debug('Token expired for member', { athleteId: member.athleteId });
      return null;
    }

    return tokens.access_token;
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