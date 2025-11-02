const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../../config/config');
const StravaAPI = require('../strava/api');
const logger = require('../utils/Logger');
const { TIME, ENCRYPTION } = require('../constants');

class MemberManager {
  constructor() {
    this.members = new Map(); // athleteId -> member data
    this.discordToStrava = new Map(); // discordUserId -> athleteId
    this.dataFile = path.join(__dirname, '../../data/members.json');
    this.stravaAPI = new StravaAPI();
  }

  // Load members from file
  async loadMembers() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const memberData = JSON.parse(data);
      
      // Clear existing maps to ensure clean state
      this.members.clear();
      this.discordToStrava.clear();
      
      const inconsistencies = [];
      const duplicateDiscordUsers = new Map();
      const duplicateAthletes = new Map();
      const decryptionErrors = [];
      
      // Decrypt and restore member data with integrity checks
      for (const member of memberData.members) {
        this._loadSingleMember(member, inconsistencies, duplicateDiscordUsers, duplicateAthletes, decryptionErrors);
      }
      
      // Log data integrity results
      if (inconsistencies.length > 0 || decryptionErrors.length > 0) {
        logger.member.warn('Data integrity issues detected during load', {
          inconsistencies,
          duplicateDiscordUsers: Object.fromEntries(duplicateDiscordUsers),
          duplicateAthletes: Object.fromEntries(duplicateAthletes),
          decryptionErrors: decryptionErrors.length > 0 ? decryptionErrors : undefined
        });
        
        if (decryptionErrors.length > 0) {
          logger.member.error(`⚠️  ${decryptionErrors.length} member(s) could not be decrypted - they will need to re-register`, {
            affectedMembers: decryptionErrors.map(e => ({ 
              discordUserId: e.discordUserId, 
              athleteId: e.athleteId 
            }))
          });
        }
        
        // Save cleaned data back to storage
        await this.saveMembers();
        logger.member.info('Cleaned member data saved after integrity check');
      }
      
      // Verify map consistency
      logger.member.debug('Pre-consistency check state', {
        totalMembers: this.members.size,
        activeMembers: Array.from(this.members.values()).filter(m => m.isActive).length,
        inactiveMembers: Array.from(this.members.values()).filter(m => !m.isActive).length,
        discordMappings: this.discordToStrava.size
      });
      
      const mapConsistencyCheck = this.verifyMapConsistency();
      if (!mapConsistencyCheck.isConsistent) {
        logger.member.error('Map consistency check failed after load', mapConsistencyCheck);
        throw new Error('Critical data integrity failure - maps are inconsistent');
      }
      
      logger.member.info('Members loaded from storage', {
        count: this.members.size,
        memberIds: Array.from(this.members.keys()),
        discordMappings: this.discordToStrava.size,
        inconsistenciesFixed: inconsistencies.length
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.member.info('No existing member data found, starting fresh');
        await this.ensureDataDirectory();
      } else {
        logger.member.error('Error loading members', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code
        });
        throw error; // Re-throw to prevent bot startup with corrupted data
      }
    }
  }

  /**
   * Load and validate a single member during loadMembers
   * @private
   */
  _loadSingleMember(member, inconsistencies, duplicateDiscordUsers, duplicateAthletes, decryptionErrors) {
    let decryptedMember;
    try {
      decryptedMember = this.decryptMemberData(member);
    } catch (decryptError) {
      // Log decryption error and skip this member
      const athleteInfo = member.athlete ? `${member.athlete.firstname} ${member.athlete.lastname} (ID: ${member.athlete.id})` : 'Unknown';
      logger.member.error('Failed to decrypt member data, skipping', {
        athlete: athleteInfo,
        discordUserId: member.discordUserId,
        error: decryptError.message
      });
      decryptionErrors.push({
        discordUserId: member.discordUserId,
        athleteId: member.athlete?.id,
        error: decryptError.message
      });
      return; // Skip this member
    }
    
    const athleteId = decryptedMember.athlete.id.toString();
    const discordUserId = decryptedMember.discordUserId;
    
    // Check for duplicate athlete IDs
    if (this.members.has(athleteId)) {
      duplicateAthletes.set(athleteId, (duplicateAthletes.get(athleteId) || 0) + 1);
      inconsistencies.push(`Duplicate athlete ID ${athleteId} found`);
      return; // Skip this duplicate
    }
    
    // Check for duplicate Discord user IDs
    if (discordUserId && this.discordToStrava.has(discordUserId)) {
      duplicateDiscordUsers.set(discordUserId, (duplicateDiscordUsers.get(discordUserId) || 0) + 1);
      inconsistencies.push(`Duplicate Discord user ID ${discordUserId} found - athlete ${athleteId} skipped`);
      return; // Skip this duplicate
    }
    
    // Add to maps
    this.members.set(athleteId, decryptedMember);
    
    // Only add active members to Discord mapping
    if (discordUserId && decryptedMember.isActive !== false) {
      this.discordToStrava.set(discordUserId, athleteId);
    } else if (!discordUserId) {
      inconsistencies.push(`Member ${athleteId} has no Discord user ID`);
    }
  }

  // Save members to file
  async saveMembers() {
    try {
      await this.ensureDataDirectory();
      
      // Encrypt member data before saving
      const membersArray = Array.from(this.members.values());
      const encryptedMembers = membersArray.map(member => this.encryptMemberData(member));
      
      const dataToSave = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        members: encryptedMembers
      };
      
      await fs.writeFile(this.dataFile, JSON.stringify(dataToSave, null, 2));
      logger.member.debug('Members saved to storage', {
        count: this.members.size,
        filePath: this.dataFile
      });
    } catch (error) {
      logger.member.error('Error saving members', error);
    }
  }

  // Save members asynchronously without blocking
  saveMembersAsync() {
    // Use setTimeout to make it truly async and non-blocking
    setTimeout(() => {
      this.saveMembers().catch(error => {
        logger.member.error('Error in async save', error);
      });
    }, 0);
  }

  // Ensure data directory exists
  async ensureDataDirectory() {
    const dataDir = path.dirname(this.dataFile);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  // Register a new member
  async registerMember(discordUserId, athlete, tokenData, discordUser = null) {
    const athleteId = athlete.id.toString();
    
    // Validate no conflicts with existing registrations
    this._validateNewRegistration(discordUserId, athleteId);
    
    // Check if we need to reactivate an existing inactive member
    const existingMemberByAthlete = this.members.get(athleteId);
    if (existingMemberByAthlete) {
      return await this._handleExistingMember(existingMemberByAthlete, athleteId, discordUserId, athlete, tokenData, discordUser);
    }
    
    // Create new member registration
    return await this._createNewMember(discordUserId, athlete, tokenData, discordUser);
  }

  /**
   * Validate that a new registration doesn't conflict with existing data
   * @private
   */
  _validateNewRegistration(discordUserId, athleteId) {
    // Check for existing Discord user registration to prevent duplicates
    const existingMemberByDiscord = this.discordToStrava.get(discordUserId);
    if (existingMemberByDiscord) {
      const existingMember = this.members.get(existingMemberByDiscord);
      if (existingMember) {
        logger.member.warn('Attempted duplicate registration', {
          discordUserId,
          existingAthleteId: existingMemberByDiscord,
          newAthleteId: athleteId
        });
        throw new Error(`Discord user ${discordUserId} is already registered to athlete ${existingMemberByDiscord}`);
      }
    }
  }

  /**
   * Handle registration of existing member (reactivation or error)
   * @private
   */
  async _handleExistingMember(existingMember, athleteId, discordUserId, athlete, tokenData, discordUser) {
    if (existingMember.isActive) {
      logger.member.warn('Attempted registration of existing active athlete', {
        athleteId,
        existingDiscordId: existingMember.discordUserId,
        newDiscordId: discordUserId
      });
      throw new Error(`Athlete ${athleteId} is already registered to Discord user ${existingMember.discordUserId}`);
    }
    
    // If member exists but is inactive, reactivate with new tokens
    if (!existingMember.isActive && existingMember.discordUserId === discordUserId) {
      return await this._reactivateMember(existingMember, athleteId, discordUserId, athlete, tokenData, discordUser);
    }
    
    throw new Error(`Athlete ${athleteId} exists but registration conditions not met`);
  }

  /**
   * Reactivate an inactive member with new tokens
   * @private
   */
  async _reactivateMember(existingMember, athleteId, discordUserId, athlete, tokenData, discordUser) {
    logger.member.info('Reactivating existing inactive member with new tokens', {
      athleteId,
      discordUserId
    });
    
    // Update tokens and reactivate
    existingMember.tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type
    };
    existingMember.lastTokenRefresh = new Date().toISOString();
    existingMember.isActive = true;
    existingMember.reactivatedAt = new Date().toISOString();
    delete existingMember.tokenError;
    delete existingMember.deactivatedAt;
    
    // Update Discord user info if provided
    if (discordUser) {
      existingMember.discordUser = {
        username: discordUser.username,
        displayName: discordUser.displayName || discordUser.globalName || discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
        avatarURL: discordUser.displayAvatarURL ? discordUser.displayAvatarURL() : null
      };
    }
    
    // Re-add to Discord mapping
    this.discordToStrava.set(discordUserId, athleteId);
    await this.saveMembers();
    
    const displayName = discordUser ? discordUser.displayName || discordUser.username : discordUserId;
    logger.memberAction('REACTIVATED', `${athlete.firstname} ${athlete.lastname}`, discordUserId, athleteId, {
      displayName,
      reactivatedAt: existingMember.reactivatedAt
    });
    
    return existingMember;
  }

  /**
   * Create a new member registration
   * @private
   */
  async _createNewMember(discordUserId, athlete, tokenData, discordUser) {
    const athleteId = athlete.id.toString();
    
    const member = {
      discordUserId: discordUserId,
      discordUser: discordUser ? {
        username: discordUser.username,
        displayName: discordUser.displayName || discordUser.globalName || discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
        avatarURL: discordUser.displayAvatarURL ? discordUser.displayAvatarURL() : null
      } : null,
      athlete: {
        id: athlete.id,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        profile: athlete.profile,
        profile_medium: athlete.profile_medium,
        city: athlete.city,
        state: athlete.state,
        country: athlete.country,
        sex: athlete.sex,
        premium: athlete.premium,
        created_at: athlete.created_at,
        updated_at: athlete.updated_at
      },
      tokens: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type
      },
      registeredAt: new Date().toISOString(),
      lastTokenRefresh: new Date().toISOString(),
      isActive: true
    };

    try {
      // Update in-memory maps
      this.members.set(athleteId, member);
      this.discordToStrava.set(discordUserId, athleteId);
      
      // CRITICAL FIX: Save synchronously to prevent race conditions
      await this.saveMembers();
      
      const displayName = discordUser ? discordUser.displayName || discordUser.username : discordUserId;
      logger.memberAction('REGISTERED', `${athlete.firstname} ${athlete.lastname}`, discordUserId, athleteId, {
        displayName,
        registeredAt: member.registeredAt
      });
      return member;
      
    } catch (error) {
      // Rollback in-memory changes if save failed
      this.members.delete(athleteId);
      this.discordToStrava.delete(discordUserId);
      
      logger.member.error('Failed to register member, rolled back changes', {
        athleteId,
        discordUserId,
        error: error.message
      });
      throw error;
    }
  }

  // Get member by athlete ID
  async getMemberByAthleteId(athleteId) {
    return this.members.get(athleteId.toString());
  }

  // Get member by Discord user ID
  async getMemberByDiscordId(discordUserId) {
    const athleteId = this.discordToStrava.get(discordUserId);
    if (athleteId) {
      return this.members.get(athleteId);
    }
    return null;
  }

  // Get all active members
  // Get all active members
  async getAllMembers() {
    return Array.from(this.members.values()).filter(member => member.isActive);
  }

  // Get all members including inactive
  async getAllMembersIncludingInactive() {
    return Array.from(this.members.values());
  }

  // Get only inactive members
  async getInactiveMembers() {
    return Array.from(this.members.values()).filter(member => !member.isActive);
  }

  // Get member count
  getMemberCount() {
    return Array.from(this.members.values()).filter(member => member.isActive).length;
  }

  // Get valid access token for member (refresh if needed)
  async getValidAccessToken(member) {
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is still valid (expires 1 hour before actual expiry for safety)
    if (member.tokens.expires_at && member.tokens.expires_at > (now + TIME.SECONDS_PER_HOUR)) {
      return member.tokens.access_token;
    }

    // Token expired or about to expire, refresh it
    const displayName = member.discordUser ? member.discordUser.displayName : member.athlete.firstname;
    logger.member.debug('Token expired, refreshing', {
      memberName: displayName,
      athleteId: member.athlete.id,
      expiresAt: member.tokens.expires_at
    });
    return await this.refreshMemberToken(member);
  }

  // Refresh member's access token
  async refreshMemberToken(member) {
    try {
      const tokenData = await this.stravaAPI.refreshAccessToken(member.tokens.refresh_token);
      
      // Update member's token data
      member.tokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type
      };
      member.lastTokenRefresh = new Date().toISOString();
      
      // Update in storage
      this.members.set(member.athlete.id.toString(), member);
      await this.saveMembers();
      
      const displayName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
      logger.memberAction('TOKEN_REFRESHED', displayName, member.discordUserId, member.athlete.id, {
        newExpiresAt: tokenData.expires_at,
        refreshedAt: member.lastTokenRefresh
      });
      return tokenData.access_token;
      
    } catch (error) {
      const displayName = member.discordUser ? member.discordUser.displayName : member.athlete.firstname;
      logger.memberAction('TOKEN_FAILED', displayName, member.discordUserId, member.athlete.id, {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // If refresh fails, mark member as inactive and remove Discord mapping
      member.isActive = false;
      member.tokenError = {
        message: error.message,
        timestamp: new Date().toISOString()
      };
      
      // Remove from Discord mapping to maintain consistency
      if (member.discordUserId) {
        this.discordToStrava.delete(member.discordUserId);
      }
      
      await this.saveMembers();
      return null;
    }
  }

  // Completely remove a member
  async removeMember(athleteId) {
    const member = this.members.get(athleteId.toString());
    if (member) {
      // Create backup of current state for rollback capability
      const memberBackup = { ...member };
      const hadDiscordMapping = this.discordToStrava.has(member.discordUserId);
      
      try {
        // Remove from Discord mapping
        if (member.discordUserId) {
          this.discordToStrava.delete(member.discordUserId);
        }
        
        // Remove from members map
        this.members.delete(athleteId.toString());
        
        // CRITICAL FIX: Save synchronously to ensure consistency
        await this.saveMembers();
        
        const displayName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
        logger.memberAction('REMOVED', displayName, member.discordUserId, athleteId, {
          removedAt: new Date().toISOString()
        });
        return member;
        
      } catch (error) {
        // Rollback changes if save failed
        this.members.set(athleteId.toString(), memberBackup);
        if (hadDiscordMapping && member.discordUserId) {
          this.discordToStrava.set(member.discordUserId, athleteId.toString());
        }
        
        logger.member.error('Failed to remove member, rolled back changes', {
          athleteId,
          discordUserId: member.discordUserId,
          error: error.message
        });
        throw error;
      }
    }
    return null;
  }

  // Remove member by Discord ID
  async removeMemberByDiscordId(discordUserId) {
    const athleteId = this.discordToStrava.get(discordUserId);
    if (athleteId) {
      return await this.removeMember(athleteId);
    }
    return null;
  }

  // Deactivate a member (soft delete)
  async deactivateMember(athleteId) {
    const member = this.members.get(athleteId.toString());
    if (member) {
      // Create backup of current state
      const wasActive = member.isActive;
      const hadDiscordMapping = this.discordToStrava.has(member.discordUserId);
      
      try {
        member.isActive = false;
        member.deactivatedAt = new Date().toISOString();
        
        // Remove from Discord mapping
        if (member.discordUserId) {
          this.discordToStrava.delete(member.discordUserId);
        }
        
        // CRITICAL FIX: Save synchronously to ensure consistency
        await this.saveMembers();
        
        const displayName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
        logger.memberAction('DEACTIVATED', displayName, member.discordUserId, athleteId, {
          deactivatedAt: member.deactivatedAt
        });
        return true;
        
      } catch (error) {
        // Rollback changes if save failed
        member.isActive = wasActive;
        delete member.deactivatedAt;
        if (hadDiscordMapping && member.discordUserId) {
          this.discordToStrava.set(member.discordUserId, athleteId.toString());
        }
        
        logger.member.error('Failed to deactivate member, rolled back changes', {
          athleteId,
          discordUserId: member.discordUserId,
          error: error.message
        });
        throw error;
      }
    }
    return false;
  }

  // Reactivate a member
  async reactivateMember(athleteId) {
    const member = this.members.get(athleteId.toString());
    if (!member) {
      return false;
    }

    const backupState = this._createMemberBackup(member);
    this._validateDiscordUserConflict(member, athleteId);

    try {
      this._applyReactivation(member, athleteId);
      await this.saveMembers();
      this._logReactivationSuccess(member, athleteId);
      return true;
    } catch (error) {
      this._rollbackReactivation(member, backupState);
      this._logReactivationFailure(member, athleteId, error);
      throw error;
    }
  }

  // Helper: Create backup of member state for rollback
  _createMemberBackup(member) {
    return {
      wasActive: member.isActive,
      oldDeactivatedAt: member.deactivatedAt,
      oldTokenError: member.tokenError,
      hadDiscordMapping: this.discordToStrava.has(member.discordUserId)
    };
  }

  // Helper: Validate Discord user conflicts before reactivation
  _validateDiscordUserConflict(member, athleteId) {
    if (member.discordUserId && this.discordToStrava.has(member.discordUserId)) {
      const conflictingAthleteId = this.discordToStrava.get(member.discordUserId);
      if (conflictingAthleteId !== athleteId.toString()) {
        logger.member.error('Cannot reactivate member - Discord user ID conflict', {
          athleteId,
          discordUserId: member.discordUserId,
          conflictingAthleteId
        });
        throw new Error(`Discord user ${member.discordUserId} is already registered to athlete ${conflictingAthleteId}`);
      }
    }
  }

  // Helper: Apply reactivation changes to member
  _applyReactivation(member, athleteId) {
    member.isActive = true;
    member.reactivatedAt = new Date().toISOString();
    delete member.deactivatedAt;
    delete member.tokenError;
    
    if (member.discordUserId) {
      this.discordToStrava.set(member.discordUserId, athleteId.toString());
    }
  }

  // Helper: Rollback reactivation changes
  _rollbackReactivation(member, backupState) {
    member.isActive = backupState.wasActive;
    if (backupState.oldDeactivatedAt) member.deactivatedAt = backupState.oldDeactivatedAt;
    if (backupState.oldTokenError) member.tokenError = backupState.oldTokenError;
    delete member.reactivatedAt;
    
    if (!backupState.hadDiscordMapping && member.discordUserId) {
      this.discordToStrava.delete(member.discordUserId);
    }
  }

  // Helper: Log successful reactivation
  _logReactivationSuccess(member, athleteId) {
    const displayName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
    logger.memberAction('REACTIVATED', displayName, member.discordUserId, athleteId, {
      reactivatedAt: member.reactivatedAt
    });
  }

  // Helper: Log reactivation failure
  _logReactivationFailure(member, athleteId, error) {
    logger.member.error('Failed to reactivate member, rolled back changes', {
      athleteId,
      discordUserId: member.discordUserId,
      error: error.message
    });
  }

  // Encrypt member data for storage
  encryptMemberData(member) {
    if (!config.security.encryptionKey) {
      return member; // Return unencrypted if no key
    }

    const algorithm = ENCRYPTION.ALGORITHM;
    const key = Buffer.from(config.security.encryptionKey, 'hex');
    const iv = crypto.randomBytes(ENCRYPTION.IV_LENGTH);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const sensitiveData = JSON.stringify(member.tokens);
    let encrypted = cipher.update(sensitiveData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      ...member,
      tokens: {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      }
    };
  }

  // Decrypt member data from storage
  decryptMemberData(encryptedMember) {
    if (!config.security.encryptionKey || !encryptedMember.tokens.encrypted) {
      return encryptedMember; // Return as-is if not encrypted
    }

    const algorithm = ENCRYPTION.ALGORITHM;
    const key = Buffer.from(config.security.encryptionKey, 'hex');
    const iv = Buffer.from(encryptedMember.tokens.iv, 'hex');
    const authTag = Buffer.from(encryptedMember.tokens.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedMember.tokens.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const tokens = JSON.parse(decrypted);
    
    return {
      ...encryptedMember,
      tokens: tokens
    };
  }

  // Verify consistency between members and discordToStrava maps
  verifyMapConsistency() {
    const errors = [];
    const membersWithDiscord = Array.from(this.members.values())
      .filter(member => member.discordUserId && member.isActive);
    
    // Check that every active member with Discord ID has correct mapping
    for (const member of membersWithDiscord) {
      const mappedAthleteId = this.discordToStrava.get(member.discordUserId);
      if (mappedAthleteId !== member.athlete.id.toString()) {
        errors.push({
          type: 'missing_or_incorrect_mapping',
          discordUserId: member.discordUserId,
          athleteId: member.athlete.id.toString(),
          mappedAthleteId
        });
      }
    }
    
    // Check that every Discord mapping points to existing active member
    for (const [discordUserId, athleteId] of this.discordToStrava.entries()) {
      const member = this.members.get(athleteId);
      if (!member) {
        errors.push({
          type: 'orphaned_discord_mapping',
          discordUserId,
          athleteId,
          reason: 'member_not_found'
        });
      } else if (!member.isActive) {
        errors.push({
          type: 'inactive_member_mapped',
          discordUserId,
          athleteId,
          reason: 'member_inactive'
        });
      } else if (member.discordUserId !== discordUserId) {
        errors.push({
          type: 'discord_id_mismatch',
          discordUserId,
          athleteId,
          memberDiscordId: member.discordUserId
        });
      }
    }
    
    return {
      isConsistent: errors.length === 0,
      errors,
      memberCount: this.members.size,
      mappingCount: this.discordToStrava.size
    };
  }

  // Get member statistics
  getStats() {
    const members = Array.from(this.members.values());
    const activeMembers = members.filter(m => m.isActive);
    const inactiveMembers = members.filter(m => !m.isActive);
    
    return {
      total: members.length,
      active: activeMembers.length,
      inactive: inactiveMembers.length,
      recentRegistrations: members.filter(m => {
        const registeredAt = new Date(m.registeredAt);
        const weekAgo = new Date(Date.now() - 7 * TIME.MS_PER_DAY);
        return registeredAt > weekAgo;
      }).length
    };
  }
}

module.exports = MemberManager;