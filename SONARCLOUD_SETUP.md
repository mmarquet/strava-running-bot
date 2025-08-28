# SonarCloud Setup Guide

This guide walks you through setting up SonarCloud code quality analysis for the Strava Running Bot.

## 🎯 What's Included

### ✅ Files Already Created

- `sonar-project.properties` - SonarCloud configuration
- `.github/workflows/sonarcloud.yml` - GitHub Actions workflow
- `tests/ActivityFormatter.test.js` - Example unit tests
- `.eslintrc.js` - ESLint configuration for code quality
- Updated `package.json` with test and lint scripts
- SonarCloud badges added to README.md

### 📊 Analysis Features

- **Code quality analysis** on every push and pull request
- **Security vulnerability detection**
- **Code coverage reporting** (when tests are added)
- **Maintainability ratings** and technical debt tracking
- **Bug detection** and code smell identification

## 🚀 Setup Steps (Manual)

### Step 1: Create SonarCloud Account

1. Go to [SonarCloud.io](https://sonarcloud.io)
2. Sign up with your GitHub account
3. Import your `strava-running-bot` repository

### Step 2: Configure Organization

1. In SonarCloud, create or select organization: `mmarquet`
2. The project key should be: `mmarquet_strava-running-bot`
3. Make sure the project is set to **public** (for free analysis)

### Step 3: Get SONAR_TOKEN

1. In SonarCloud, go to **My Account > Security**
2. Generate a new token named "strava-bot-github-actions"
3. Copy the token (you'll need it in the next step)

### Step 4: Add GitHub Secret

1. Go to your GitHub repository: `https://github.com/mmarquet/strava-running-bot`
2. Go to **Settings > Secrets and Variables > Actions**
3. Click **New repository secret**
4. Name: `SONAR_TOKEN`
5. Value: [paste the token from SonarCloud]
6. Click **Add secret**

### Step 5: Trigger Analysis

1. Push this commit to GitHub
2. The GitHub Action will automatically run
3. Check the **Actions** tab to see the workflow progress
4. View results in SonarCloud dashboard

## 🔧 Local Development

### Install Dependencies

```bash
npm install
```

### Run Tests Locally

```bash
npm test                # Run tests with coverage
npm run test:watch      # Run tests in watch mode
```

### Run Linting

```bash
npm run lint            # Check code style
npm run lint:fix        # Fix auto-fixable issues
```

### Manual SonarCloud Analysis (Optional)

If you have SonarCloud CLI installed:

```bash
sonar-scanner
```

## 📈 Quality Metrics

The SonarCloud analysis will provide:

### 🎯 Quality Gate Criteria

- **Coverage**: New code coverage > 80%
- **Duplications**: New code duplication < 3%
- **Maintainability**: New code maintainability rating = A
- **Reliability**: New code reliability rating = A
- **Security**: New code security rating = A

### 📊 Metrics Tracked

- **Lines of Code**: Total codebase size
- **Bugs**: Reliability issues that should be fixed
- **Vulnerabilities**: Security issues requiring attention
- **Code Smells**: Maintainability issues and technical debt
- **Coverage**: Percentage of code covered by tests
- **Duplications**: Repeated code blocks

## 🎨 README Badges

The following badges are now displayed in README.md:

- **Quality Gate Status**: Overall pass/fail status
- **Maintainability Rating**: A-E rating for code maintainability  
- **Security Rating**: A-E rating for security issues
- **Bugs**: Number of reliability issues
- **Code Smells**: Number of maintainability issues

## 🔧 Configuration Details

### SonarCloud Project Settings

- **Project Key**: `mmarquet_strava-running-bot`
- **Organization**: `mmarquet`
- **Source Directory**: `src/`
- **Test Directory**: `tests/`
- **Exclusions**: `node_modules`, `coverage`, `docs`

### GitHub Actions Workflow

- **Triggers**: Push to `strava-running-bot` and `main` branches, pull requests
- **Node.js Version**: 24
- **Quality Gate**: Enforced but non-blocking initially
- **Coverage**: Generated if tests exist

## 🚨 Next Steps

### Immediate

1. Complete SonarCloud setup following steps above
2. Verify first analysis runs successfully
3. Review initial code quality report

### Future Improvements

1. **Add more tests**: Increase code coverage
2. **Fix code smells**: Address maintainability issues
3. **Security review**: Address any security hotspots
4. **Performance**: Monitor and optimize based on metrics

## 📞 Troubleshooting

### Common Issues

1. **SONAR_TOKEN not working**: Regenerate token in SonarCloud
2. **Quality Gate failing**: Review specific criteria in SonarCloud
3. **Tests not running**: Check Jest configuration in package.json
4. **ESLint errors**: Run `npm run lint:fix` to auto-fix issues

### Support

- SonarCloud Community: <https://community.sonarsource.com/>
- GitHub Actions Docs: <https://docs.github.com/en/actions>

---

**Quality matters!** 🎯 SonarCloud will help maintain high code standards as your bot grows.
