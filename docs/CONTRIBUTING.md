# Contributing to Strava Running Bot

Thank you for your interest in contributing to the Strava Running Bot! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Types](#contribution-types)
- [Development Guidelines](#development-guidelines)
- [Submitting Changes](#submitting-changes)
- [Code Review Process](#code-review-process)
- [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to providing a friendly, safe, and welcoming environment for all contributors, regardless of experience level, gender identity, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior include:

- The use of sexualized language or imagery and unwelcome sexual attention or advances
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

## Getting Started

### Prerequisites

Before contributing, ensure you have completed the basic setup from the [main README](../README.md):

- ✅ Node.js 24+ installed
- ✅ Development environment working
- ✅ Discord and Strava accounts for testing

For detailed setup instructions, follow the [Quick Start guide](../README.md#-quick-start).

### Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/yourusername/strava-running-bot.git
   cd strava-running-bot
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/original/strava-running-bot.git
   ```

## Development Setup

### Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Configure environment variables in .env
# At minimum, set:
# - DISCORD_TOKEN (test bot)
# - DISCORD_CHANNEL_ID (test channel)
# - STRAVA_CLIENT_ID
# - STRAVA_CLIENT_SECRET
# - ENCRYPTION_KEY

# Start development server
npm run dev
```

### Testing Environment

Set up a separate Discord server and Strava app for development:

1. **Test Discord Server**: Create a private server for development
2. **Test Bot**: Create separate Discord bot for development
3. **Test Strava App**: Create development Strava application
4. **Test Channel**: Use dedicated channel for test activity posts

### Docker Development

```bash
# Build and run with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose down && docker-compose up -d --build
```

## Contribution Types

### Bug Reports

When reporting bugs, please include:

- **Clear description** of the issue
- **Steps to reproduce** the problem
- **Expected vs actual behavior**
- **Environment details** (OS, Node version, deployment method)
- **Logs** (sanitized to remove sensitive data)
- **Screenshots** if applicable

### Feature Requests

For new features, please provide:

- **Use case description** - Why is this needed?
- **Proposed solution** - How should it work?
- **Alternative solutions** - What other approaches were considered?
- **Impact assessment** - Who would benefit from this feature?

### Code Contributions

We welcome contributions for:

- **Bug fixes**
- **New features**
- **Performance improvements**
- **Documentation improvements**
- **Test coverage improvements**
- **Security enhancements**

### Documentation

Help improve documentation by:

- **Fixing typos and errors**
- **Adding examples**
- **Improving clarity**
- **Adding missing sections**
- **Updating outdated information**

## Development Guidelines

### Code Style

We follow these coding standards:

#### JavaScript/Node.js

```javascript
// Use ES6+ features
const { Client } = require('discord.js');

// Use meaningful variable names
const memberManager = new MemberManager();

// Use async/await over callbacks
async function processActivity(activityId) {
  try {
    const activity = await stravaAPI.getActivity(activityId);
    return activity;
  } catch (error) {
    console.error('Failed to fetch activity:', error);
    throw error;
  }
}

// Use proper error handling
// Always handle errors gracefully
// Log errors with context

// Use JSDoc for complex functions
/**
 * Processes a new Strava activity and posts to Discord
 * @param {number} activityId - Strava activity ID
 * @param {number} athleteId - Strava athlete ID
 * @returns {Promise<boolean>} Success status
 */
async function processNewActivity(activityId, athleteId) {
  // Implementation
}
```

#### File Organization

```text
src/
├── discord/           # Discord-specific code
├── strava/           # Strava API integration
├── server/           # Web server and webhooks
├── processors/       # Business logic processors
├── managers/         # Data management classes
└── utils/           # Utility functions

docs/                # Documentation
tests/              # Test files (when implemented)
config/             # Configuration files
```

#### Naming Conventions

- **Files**: kebab-case (e.g., `member-manager.js`)
- **Classes**: PascalCase (e.g., `MemberManager`)
- **Functions**: camelCase (e.g., `processActivity`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Environment Variables**: UPPER_SNAKE_CASE (e.g., `DISCORD_TOKEN`)

### Security Guidelines

- **Never commit sensitive data** (tokens, keys, passwords)
- **Validate all user input** before processing
- **Use environment variables** for configuration
- **Implement rate limiting** for API endpoints
- **Use HTTPS in production**
- **Sanitize log output** to prevent information leakage
- **Follow principle of least privilege**

### Performance Guidelines

- **Use async/await** for I/O operations
- **Implement proper error handling** with retries
- **Cache frequently accessed data** when appropriate
- **Use efficient data structures**
- **Monitor memory usage** and prevent leaks
- **Implement proper logging** levels

### Testing Guidelines

When implementing tests (future work):

```javascript
// Use descriptive test names
describe('MemberManager', () => {
  describe('registerMember', () => {
    it('should successfully register a new member with valid data', async () => {
      // Test implementation
    });
    
    it('should reject registration with invalid Discord ID', async () => {
      // Test implementation
    });
  });
});

// Test error conditions
// Test edge cases
// Mock external dependencies
// Use appropriate assertions
```

## Submitting Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-activity-filters`
- `bugfix/fix-token-refresh`
- `docs/update-deployment-guide`
- `security/improve-input-validation`

### Commit Messages

Write clear, descriptive commit messages:

```bash
# Good examples
git commit -m "Add support for swimming activities in Discord embeds"
git commit -m "Fix token refresh error handling in MemberManager"
git commit -m "Update deployment documentation for Docker"

# Poor examples
git commit -m "fix bug"
git commit -m "update"
git commit -m "changes"
```

### Pull Request Process

1. **Update your fork**:

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**:
   - Follow coding guidelines
   - Add/update documentation
   - Test your changes thoroughly

4. **Commit your changes**:

   ```bash
   git add .
   git commit -m "Descriptive commit message"
   ```

5. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**:
   - Use descriptive title and description
   - Reference related issues
   - Include testing instructions
   - Add screenshots if applicable

### Pull Request Template

```markdown
## Description
Brief description of the changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] I have tested these changes locally
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] I have updated documentation as needed

## Related Issues
Fixes #(issue number)

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Notes
Any additional information or context about the changes.
```

## Code Review Process

### Review Criteria

Code reviews will assess:

- **Functionality**: Does the code work as intended?
- **Code Quality**: Is the code readable, maintainable, and well-structured?
- **Security**: Are there any security vulnerabilities?
- **Performance**: Are there any performance issues?
- **Documentation**: Is the code adequately documented?
- **Testing**: Are there sufficient tests (when test suite exists)?

### Review Timeline

- **Initial Response**: Within 48 hours
- **Review Completion**: Within 1 week for most PRs
- **Complex Changes**: May take longer, will communicate timeline

### Addressing Feedback

When receiving review feedback:

1. **Respond promptly** to questions and requests
2. **Make requested changes** in additional commits
3. **Explain your reasoning** if you disagree with feedback
4. **Test thoroughly** after making changes
5. **Update documentation** if needed

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code review and collaboration

### Getting Help

If you need help:

1. **Check documentation** first
2. **Search existing issues** for similar problems
3. **Ask questions** in GitHub Discussions
4. **Provide context** when asking for help

### Recognition

Contributors will be recognized through:

- **Contributors section** in README
- **Changelog mentions** for significant contributions
- **GitHub contributor graphs**

## Development Roadmap

### Current Priorities

1. **Test Suite Implementation**
   - Unit tests for core functionality
   - Integration tests for API interactions
   - End-to-end tests for complete workflows

2. **Performance Optimization**
   - Database implementation for large teams
   - Caching layer for frequently accessed data
   - API rate limiting improvements

3. **Feature Enhancements**
   - Activity filtering options
   - Team statistics and leaderboards
   - Custom activity templates

4. **Security Improvements**
   - Enhanced input validation
   - Audit logging
   - Security scanning integration

### Future Goals

- **Multi-team Support**: Support for multiple teams per bot instance
- **Web Dashboard**: Web interface for team management
- **Mobile App**: Companion mobile application
- **Advanced Analytics**: Detailed team performance analytics

## Questions?

If you have questions about contributing, please:

1. Check this document first
2. Search existing GitHub issues
3. Create a new issue with the "question" label
4. Reach out through GitHub Discussions

Thank you for contributing to Strava Running Bot! Your efforts help make this project better for the entire running community. 🏃‍♂️💪
