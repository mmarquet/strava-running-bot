#!/usr/bin/env node

/**
 * Batch Token Refresh Script
 *
 * This script checks all registered members for expired Strava OAuth tokens
 * and attempts to refresh them automatically. This is useful for:
 * - Initial migration to auto-refresh system
 * - Periodic maintenance to ensure all tokens are valid
 * - Recovery after extended bot downtime
 *
 * Usage: node scripts/refresh-expired-tokens.js
 */

const chalk = require('chalk');
const DatabaseMemberManager = require('../src/database/DatabaseMemberManager');
const logger = require('../src/utils/Logger');

// Utility functions for colored console output
const success = (msg) => console.log(chalk.green('✓'), msg);
const error = (msg) => console.log(chalk.red('✗'), msg);
const info = (msg) => console.log(chalk.blue('ℹ'), msg);
const warning = (msg) => console.log(chalk.yellow('⚠'), msg);

class TokenRefreshManager {
  constructor() {
    this.memberManager = new DatabaseMemberManager();
    this.stats = {
      total: 0,
      valid: 0,
      refreshed: 0,
      failed: 0,
      noTokens: 0,
      noRefreshToken: 0,
      revoked: 0
    };
  }

  async initialize() {
    await this.memberManager.initialize();
  }

  async close() {
    await this.memberManager.close();
  }

  /**
   * Check if a token is expired
   */
  isTokenExpired(expiresAt) {
    if (!expiresAt) return true;
    return expiresAt < Date.now() / 1000;
  }

  /**
   * Format expiration date for display
   */
  formatExpiration(expiresAt) {
    if (!expiresAt) return 'unknown';
    const date = new Date(expiresAt * 1000);
    const now = new Date();
    const diffHours = Math.floor((date - now) / (1000 * 60 * 60));

    if (diffHours < 0) {
      return `${chalk.red('expired')} ${Math.abs(diffHours)}h ago`;
    } else if (diffHours < 24) {
      return `${chalk.yellow('expires in')} ${diffHours}h`;
    } else {
      return `${chalk.green('valid for')} ${Math.floor(diffHours / 24)}d`;
    }
  }

  /**
   * Process a single member's tokens
   */
  async processMember(member) {
    const memberName = member.discordUser?.displayName ||
                      `${member.athlete?.firstname} ${member.athlete?.lastname}` ||
                      'Unknown';

    console.log(chalk.bold(`\n${member.athleteId}: ${memberName}`));

    // Check if member has any tokens
    if (!member.tokens?.encrypted) {
      this.stats.noTokens++;
      warning('  No tokens stored in database');
      return;
    }

    try {
      // Decrypt tokens to check expiration
      const tokenData = this.memberManager._decryptTokenData(member.tokens, member.athleteId);

      if (!tokenData) {
        this.stats.failed++;
        error('  Could not decrypt tokens');
        return;
      }

      // Check if token is expired
      const expired = this.isTokenExpired(tokenData.expires_at);
      const expirationInfo = this.formatExpiration(tokenData.expires_at);

      info(`  Token status: ${expirationInfo}`);

      if (!expired) {
        this.stats.valid++;
        success('  Token is still valid - no refresh needed');
        return;
      }

      // Token is expired - attempt refresh
      warning('  Token expired - attempting refresh...');

      if (!tokenData.refresh_token) {
        this.stats.noRefreshToken++;
        error('  No refresh token available - user needs to re-authenticate');
        return;
      }

      try {
        // Use the auto-refresh functionality we just implemented
        const newAccessToken = await this.memberManager.getValidAccessToken(member);

        if (newAccessToken) {
          this.stats.refreshed++;
          success('  Token refreshed successfully!');

          // Read updated member to show new expiration
          const updatedMember = await this.memberManager.getMemberByAthleteId(member.athleteId);
          if (updatedMember?.tokens?.encrypted) {
            const newTokenData = this.memberManager._decryptTokenData(
              updatedMember.tokens,
              updatedMember.athleteId
            );
            if (newTokenData) {
              const newExpiration = this.formatExpiration(newTokenData.expires_at);
              info(`  New expiration: ${newExpiration}`);
            }
          }
        } else {
          this.stats.failed++;
          error('  Token refresh returned null - check logs for details');
        }
      } catch (refreshError) {
        if (refreshError.response?.status === 401) {
          this.stats.revoked++;
          error('  Token was revoked - user needs to re-authenticate via /register');
        } else {
          this.stats.failed++;
          error(`  Token refresh failed: ${refreshError.message}`);
        }
      }

    } catch (decryptError) {
      this.stats.failed++;
      error(`  Error processing tokens: ${decryptError.message}`);
    }
  }

  /**
   * Process all members
   */
  async processAllMembers() {
    const members = await this.memberManager.getAllMembers();
    this.stats.total = members.length;

    console.log(chalk.bold.cyan(`\n${'='.repeat(60)}`));
    console.log(chalk.bold.cyan('Strava Token Refresh - Starting Batch Process'));
    console.log(chalk.bold.cyan(`${'='.repeat(60)}\n`));
    info(`Found ${members.length} total members\n`);

    for (const member of members) {
      await this.processMember(member);
    }
  }

  /**
   * Display summary statistics
   */
  displaySummary() {
    console.log(chalk.bold.cyan(`\n${'='.repeat(60)}`));
    console.log(chalk.bold.cyan('Summary'));
    console.log(chalk.bold.cyan(`${'='.repeat(60)}\n`));

    console.log(`Total members:          ${this.stats.total}`);
    console.log(chalk.green(`✓ Valid tokens:         ${this.stats.valid}`));
    console.log(chalk.green(`✓ Refreshed:            ${this.stats.refreshed}`));
    console.log(chalk.yellow(`⚠ No tokens:            ${this.stats.noTokens}`));
    console.log(chalk.yellow(`⚠ No refresh token:     ${this.stats.noRefreshToken}`));
    console.log(chalk.red(`✗ Revoked tokens:       ${this.stats.revoked}`));
    console.log(chalk.red(`✗ Failed:               ${this.stats.failed}`));

    const needsAction = this.stats.noTokens +
                       this.stats.noRefreshToken +
                       this.stats.revoked +
                       this.stats.failed;

    if (needsAction > 0) {
      console.log(chalk.bold.yellow(`\n⚠ ${needsAction} member(s) need attention:`));

      if (this.stats.noTokens > 0) {
        console.log(chalk.yellow(`  • ${this.stats.noTokens} member(s) have no tokens - need to use /register`));
      }
      if (this.stats.noRefreshToken > 0) {
        console.log(chalk.yellow(`  • ${this.stats.noRefreshToken} member(s) have no refresh token - need to re-authenticate`));
      }
      if (this.stats.revoked > 0) {
        console.log(chalk.red(`  • ${this.stats.revoked} member(s) have revoked tokens - need to use /register`));
      }
      if (this.stats.failed > 0) {
        console.log(chalk.red(`  • ${this.stats.failed} member(s) failed to refresh - check logs for details`));
      }
    } else {
      console.log(chalk.bold.green('\n✓ All members have valid tokens!'));
    }

    console.log();
  }
}

/**
 * Main execution
 */
async function main() {
  const refreshManager = new TokenRefreshManager();

  try {
    await refreshManager.initialize();
    await refreshManager.processAllMembers();
    refreshManager.displaySummary();

    await refreshManager.close();
    process.exit(0);
  } catch (error) {
    console.error(chalk.red.bold('\n✗ Fatal error:'), error.message);
    console.error(error.stack);

    await refreshManager.close();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nInterrupted - cleaning up...'));
  process.exit(130);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n\nTerminated - cleaning up...'));
  process.exit(143);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = TokenRefreshManager;
