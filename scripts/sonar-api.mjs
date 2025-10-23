#!/usr/bin/env node
/**
 * SonarCloud API Integration Script
 * This script fetches issues and quality reports from SonarCloud API
 * Usage: node scripts/sonar-api.js [command] [options]
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const SONAR_BASE_URL = process.env.SONAR_BASE_URL || 'https://sonarcloud.io/api';
const PROJECT_KEY = process.env.SONAR_PROJECT_KEY || 'mistral-cli';
const ORG_KEY = process.env.SONAR_ORGANIZATION;

class SonarCloudAPI {
  constructor(token) {
    this.token = token;
  }

  async makeRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const url = `${SONAR_BASE_URL}${endpoint}`;
      const options = {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        }
      };

      https.get(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  async getProjectStatus() {
    try {
      const response = await this.makeRequest(`/qualitygates/project_status?projectKey=${PROJECT_KEY}`);
      return response;
    } catch (error) {
      console.error('Error fetching project status:', error.message);
      return null;
    }
  }

  async getIssues(severity = null, type = null) {
    try {
      let endpoint = `/issues/search?componentKeys=${PROJECT_KEY}&organization=${ORG_KEY}`;

      if (severity) {
        endpoint += `&severities=${severity}`;
      }

      if (type) {
        endpoint += `&types=${type}`;
      }

      endpoint += '&ps=500'; // Page size
      endpoint += '&resolved=false'; // Only unresolved issues
      endpoint += '&sinceLeakPeriod=false'; // All issues, not just new ones

      console.log(`DEBUG: Fetching from: ${SONAR_BASE_URL}${endpoint}`);
      const response = await this.makeRequest(endpoint);
      console.log(`DEBUG: Got ${response?.total || 0} total issues, ${response?.issues?.length || 0} in response`);
      return response;
    } catch (error) {
      console.error('Error fetching issues:', error.message);
      return null;
    }
  }

  async getHotspots() {
    try {
      const response = await this.makeRequest(`/hotspots/search?projectKey=${PROJECT_KEY}&organization=${ORG_KEY}`);
      return response;
    } catch (error) {
      console.error('Error fetching security hotspots:', error.message);
      return null;
    }
  }

  async getMeasures() {
    try {
      const metrics = [
        'alert_status',
        'quality_gate_details',
        'bugs',
        'vulnerabilities',
        'security_hotspots',
        'code_smells',
        'coverage',
        'duplicated_lines_density',
        'ncloc',
        'sqale_index'
      ].join(',');

      const response = await this.makeRequest(`/measures/component?component=${PROJECT_KEY}&metricKeys=${metrics}`);
      return response;
    } catch (error) {
      console.error('Error fetching measures:', error.message);
      return null;
    }
  }

  formatIssuesReport(issues) {
    if (!issues || !issues.issues) {
      return 'No issues found or failed to fetch issues.';
    }

    let report = `\n=== SonarCloud Issues Report ===\n`;
    report += `Total Issues: ${issues.total}\n`;
    report += `Page: ${issues.paging.pageIndex}/${Math.ceil(issues.total / issues.paging.pageSize)}\n\n`;

    // Group by severity
    const bySeverity = {};
    const byType = {};

    issues.issues.forEach(issue => {
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    });

    report += `By Severity:\n`;
    Object.entries(bySeverity).forEach(([severity, count]) => {
      report += `  ${severity}: ${count}\n`;
    });

    report += `\nBy Type:\n`;
    Object.entries(byType).forEach(([type, count]) => {
      report += `  ${type}: ${count}\n`;
    });

    report += `\n=== Detailed Issues ===\n`;

    issues.issues.slice(0, 20).forEach((issue, index) => {
      report += `\n${index + 1}. [${issue.severity}] ${issue.type}\n`;
      report += `   Rule: ${issue.rule}\n`;
      report += `   File: ${issue.component.replace(`${PROJECT_KEY}:`, '')}\n`;
      report += `   Line: ${issue.line || 'N/A'}\n`;
      report += `   Message: ${issue.message}\n`;

      if (issue.debt) {
        report += `   Technical Debt: ${issue.debt}\n`;
      }
    });

    if (issues.issues.length > 20) {
      report += `\n... and ${issues.issues.length - 20} more issues.\n`;
    }

    return report;
  }

  formatMeasuresReport(measures) {
    if (!measures || !measures.component || !measures.component.measures) {
      return 'No measures found or failed to fetch measures.';
    }

    let report = `\n=== SonarCloud Quality Report ===\n`;
    report += `Project: ${measures.component.name}\n`;
    report += `Key: ${measures.component.key}\n\n`;

    const measureMap = {};
    measures.component.measures.forEach(measure => {
      measureMap[measure.metric] = measure.value;
    });

    report += `Quality Gate: ${measureMap.alert_status || 'UNKNOWN'}\n`;
    report += `Bugs: ${measureMap.bugs || '0'}\n`;
    report += `Vulnerabilities: ${measureMap.vulnerabilities || '0'}\n`;
    report += `Security Hotspots: ${measureMap.security_hotspots || '0'}\n`;
    report += `Code Smells: ${measureMap.code_smells || '0'}\n`;
    report += `Coverage: ${measureMap.coverage || '0'}%\n`;
    report += `Duplicated Lines: ${measureMap.duplicated_lines_density || '0'}%\n`;
    report += `Lines of Code: ${measureMap.ncloc || '0'}\n`;
    report += `Technical Debt: ${measureMap.sqale_index ? Math.round(measureMap.sqale_index / 60) + ' hours' : '0'}\n`;

    return report;
  }

  async generateFullReport() {
    console.log('Fetching SonarCloud data...\n');

    const [status, issues, hotspots, measures] = await Promise.all([
      this.getProjectStatus(),
      this.getIssues(),
      this.getHotspots(),
      this.getMeasures()
    ]);

    let fullReport = `SonarCloud Report for ${PROJECT_KEY}\n`;
    fullReport += `Generated: ${new Date().toISOString()}\n`;
    fullReport += `${'='.repeat(50)}\n`;

    if (measures) {
      fullReport += this.formatMeasuresReport(measures);
    }

    if (issues) {
      fullReport += this.formatIssuesReport(issues);
    }

    if (hotspots && hotspots.hotspots && hotspots.hotspots.length > 0) {
      fullReport += `\n=== Security Hotspots ===\n`;
      hotspots.hotspots.forEach((hotspot, index) => {
        fullReport += `\n${index + 1}. ${hotspot.message}\n`;
        fullReport += `   File: ${hotspot.component.replace(`${PROJECT_KEY}:`, '')}\n`;
        fullReport += `   Line: ${hotspot.line}\n`;
        fullReport += `   Status: ${hotspot.status}\n`;
      });
    }

    return fullReport;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'report';

  const token = process.env.SONAR_TOKEN;
  const organization = process.env.SONAR_ORGANIZATION;

  if (!token) {
    console.error('Error: SONAR_TOKEN environment variable is required');
    console.error('Usage: SONAR_TOKEN=your_token SONAR_ORGANIZATION=your_org node scripts/sonar-api.js [command]');
    process.exit(1);
  }

  if (!organization) {
    console.error('Error: SONAR_ORGANIZATION environment variable is required');
    console.error('Usage: SONAR_TOKEN=your_token SONAR_ORGANIZATION=your_org node scripts/sonar-api.js [command]');
    process.exit(1);
  }

  const sonar = new SonarCloudAPI(token);

  try {
    switch (command) {
      case 'status':
        const status = await sonar.getProjectStatus();
        console.log(JSON.stringify(status, null, 2));
        break;

      case 'issues':
        const severity = args[1];
        const type = args[2];
        const issues = await sonar.getIssues(severity, type);
        console.log(sonar.formatIssuesReport(issues));
        break;

      case 'measures':
        const measures = await sonar.getMeasures();
        console.log(sonar.formatMeasuresReport(measures));
        break;

      case 'hotspots':
        const hotspots = await sonar.getHotspots();
        console.log(JSON.stringify(hotspots, null, 2));
        break;

      case 'report':
        const report = await sonar.generateFullReport();
        console.log(report);

        // Save to file
        const reportFile = path.join(process.cwd(), 'sonar-report.txt');
        fs.writeFileSync(reportFile, report);
        console.log(`\nReport saved to: ${reportFile}`);
        break;

      case 'help':
        console.log(`
SonarCloud API Tool

Usage: SONAR_TOKEN=your_token SONAR_ORGANIZATION=your_org node scripts/sonar-api.js [command]

Environment Variables:
  SONAR_TOKEN        Your SonarCloud API token (required)
  SONAR_ORGANIZATION Your SonarCloud organization (required)
  SONAR_PROJECT_KEY  Project key (default: mistral-cli)
  SONAR_BASE_URL     SonarCloud API URL (default: https://sonarcloud.io/api)

Commands:
  report          Generate full quality report (default)
  status          Get quality gate status
  issues [sev] [type]  Get issues (optional: severity, type filters)
  measures        Get quality measures
  hotspots        Get security hotspots
  help            Show this help

Examples:
  SONAR_TOKEN=xyz SONAR_ORGANIZATION=myorg node scripts/sonar-api.js report
  SONAR_TOKEN=xyz SONAR_ORGANIZATION=myorg node scripts/sonar-api.js issues MAJOR BUG
  SONAR_TOKEN=xyz SONAR_ORGANIZATION=myorg node scripts/sonar-api.js issues CRITICAL
        `);
        break;

      default:
        const defaultReport = await sonar.generateFullReport();
        console.log(defaultReport);

        // Save to file
        const defaultReportFile = path.join(process.cwd(), 'sonar-report.txt');
        fs.writeFileSync(defaultReportFile, defaultReport);
        console.log(`\nReport saved to: ${defaultReportFile}`);
        break;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SonarCloudAPI;