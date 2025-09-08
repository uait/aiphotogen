# Test Management System Setup Guide

## Overview
This guide walks you through setting up the comprehensive test management system that integrates Playwright tests with Monday.com and provides Claude with direct test case management capabilities.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Install additional dependencies for test management
npm install @babel/parser @babel/traverse node-fetch

# For MCP server (optional)
npm install @modelcontextprotocol/sdk
```

### 2. Set Environment Variables
```bash
# Monday.com Integration
export MONDAY_API_TOKEN="your_monday_api_token_here"
export MONDAY_BOARD_ID="your_board_id_here"

# Optional: Add to .env.local
echo "MONDAY_API_TOKEN=your_token" >> .env.local
echo "MONDAY_BOARD_ID=your_board_id" >> .env.local
```

### 3. Extract Test Cases from Code
```bash
npm run test:extract
```

### 4. Sync with Monday.com
```bash
npm run test:sync-monday
```

## 📊 Monday.com Board Setup

### Required Columns
Create a Monday.com board with these columns:

| Column Name | Type | Description |
|-------------|------|-------------|
| `test_id` | Text | Unique test case ID (e.g., HP-001) |
| `priority` | Status | critical, high, medium, low |
| `category` | Text | Test category (smoke, auth, etc.) |
| `status` | Status | Not Started, In Progress, Passed, Failed |
| `suite` | Text | Test suite (e2e, functional, unit) |
| `browsers` | Text | Supported browsers |
| `tags` | Text | Test tags |
| `description` | Long Text | Test description |
| `last_result` | Status | Latest test result |
| `last_execution` | Date | Last execution date |
| `execution_time` | Text | Test duration |
| `error_message` | Long Text | Error details if failed |

### Getting Your API Token
1. Go to Monday.com → Profile → Admin → API
2. Generate a new API token
3. Copy the token to your environment variables

### Getting Board ID
1. Go to your Monday.com board
2. Check the URL: `https://company.monday.com/boards/123456789`
3. The number `123456789` is your board ID

## 🤖 Claude Integration (MCP Server)

### 1. Create MCP Server
```bash
# Create the MCP server file
node -e "
const fs = require('fs');
const template = \`// MCP Server implementation
// See tests/test-management/test-case-mcp.md for full implementation
\`;
fs.writeFileSync('tests/test-management/mcp-server.js', template);
"
```

### 2. Configure Claude Desktop
Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "test-case-manager": {
      "command": "node",
      "args": ["tests/test-management/mcp-server.js"],
      "env": {
        "MONDAY_API_TOKEN": "your_token",
        "MONDAY_BOARD_ID": "your_board_id"
      }
    }
  }
}
```

### 3. Restart Claude Desktop
Restart Claude Desktop to load the new MCP server.

## 📝 Usage Examples

### Automatic Test Case Extraction
```bash
# Extract test cases from all test files
npm run test:extract

# This will create/update tests/test-management/test-case-registry.json
```

### Monday.com Synchronization
```bash
# Sync test cases with Monday.com
npm run test:sync-monday

# Update both registry and Monday.com
npm run test:update-registry
```

### Running Tests with Result Updates
```bash
# Run tests and generate JSON report
npm run test -- --reporter=json > test-results.json

# Sync results with Monday.com
npm run test:sync-monday test-results.json
```

### Claude Commands (with MCP)
```
# Create a new test case
Claude, create a test case:
- ID: AUTH-004  
- Name: "should handle password reset"
- Priority: high
- Suite: e2e

# Run specific test suite
Claude, run the authentication tests and update Monday.com

# Get test coverage analysis
Claude, show me test coverage gaps for the homepage
```

## 🔧 Customization

### Test ID Generation
Edit `test-extractor.js` to customize test ID prefixes:

```javascript
const prefixMap = {
  'homepage': 'HP',
  'authentication': 'AUTH', 
  'ai-interactions': 'AI',
  'account-settings': 'ACC',
  'components': 'COMP',
  'your-new-file': 'YNF'  // Add custom prefixes
};
```

### Priority Detection
Customize priority detection keywords in `test-extractor.js`:

```javascript
const criticalKeywords = ['critical', 'login', 'auth', 'core', 'payment', 'security'];
const highKeywords = ['important', 'key', 'primary', 'major', 'signup'];
```

### Monday.com Column Mapping
Update column IDs in `monday-integration.js` to match your board:

```javascript
const columnValues = {
  "text": testCase.id,           // Map to your Test ID column
  "status": testCase.priority,  // Map to your Priority column
  // ... customize other mappings
};
```

## 🔍 Monitoring & Analytics

### Test Registry Structure
The `test-case-registry.json` provides:
- Complete test case catalog
- Test metrics and coverage
- Execution history
- Browser compatibility matrix

### Monday.com Dashboards
Create Monday.com dashboards to track:
- Test execution trends
- Failed test analysis
- Coverage by priority/category
- Browser compatibility status

### Automated Reports
Set up automated reports by:
1. Scheduling `npm run test:update-registry` via cron
2. Creating Monday.com automations for notifications
3. Integrating with CI/CD for deployment gates

## 🚨 Troubleshooting

### Common Issues

#### "Monday.com API Error"
- Verify your API token is valid
- Check board permissions
- Ensure board ID is correct

#### "Test extraction failed"
- Install required Babel dependencies
- Check test file syntax
- Verify file paths in extractor

#### "MCP Server not connecting"
- Restart Claude Desktop
- Check MCP server file path
- Verify environment variables

### Debug Commands
```bash
# Test Monday.com connection
node -e "
const { MondayTestIntegration } = require('./tests/test-management/monday-integration.js');
const integration = new MondayTestIntegration(process.env.MONDAY_API_TOKEN, process.env.MONDAY_BOARD_ID);
integration.query('query { me { name } }').then(console.log).catch(console.error);
"

# Validate test registry
node -e "
const registry = require('./tests/test-management/test-case-registry.json');
console.log('Total tests:', registry.testRegistry.metrics.totalTestCases);
"
```

## 🔄 CI/CD Integration

### GitHub Actions
Add to your workflow:

```yaml
- name: Update Test Registry
  run: npm run test:update-registry
  env:
    MONDAY_API_TOKEN: ${{ secrets.MONDAY_API_TOKEN }}
    MONDAY_BOARD_ID: ${{ secrets.MONDAY_BOARD_ID }}

- name: Run Tests and Sync Results
  run: |
    npm test -- --reporter=json > test-results.json
    npm run test:sync-monday test-results.json
```

### Pre-commit Hooks
```bash
# Add to .husky/pre-commit
npm run test:extract
git add tests/test-management/test-case-registry.json
```

## 📚 Advanced Features

### Custom Test Extractors
Create extractors for other test frameworks by extending `TestCaseExtractor`.

### Integration Plugins
Build plugins for other project management tools (Jira, Asana, etc.).

### AI-Powered Test Generation
Use Claude with MCP to automatically generate test cases based on code changes.

### Test Impact Analysis
Track which tests are affected by code changes using Git hooks.

This setup provides a complete test management ecosystem that scales with your project and integrates seamlessly with your development workflow.