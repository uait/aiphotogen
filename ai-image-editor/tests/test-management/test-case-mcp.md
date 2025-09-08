# Test Case Management MCP Server

## Overview
A Model Context Protocol (MCP) server that provides Claude with direct access to test case management, allowing for seamless integration between AI assistance and test automation.

## MCP Server Capabilities

### Tools

#### `create_test_case`
Create a new test case with full specification
```json
{
  "name": "create_test_case",
  "description": "Create a new test case with specifications",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Unique test case ID" },
      "name": { "type": "string", "description": "Test case name" },
      "suite": { "type": "string", "description": "Test suite (e2e, functional, unit)" },
      "priority": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
      "category": { "type": "string", "description": "Test category" },
      "description": { "type": "string", "description": "Test description" },
      "prerequisites": { "type": "string", "description": "Test prerequisites" },
      "steps": { "type": "array", "items": { "type": "string" } },
      "expectedResult": { "type": "string", "description": "Expected test result" },
      "browsers": { "type": "array", "items": { "type": "string" } },
      "tags": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["id", "name", "suite", "priority", "description"]
  }
}
```

#### `update_test_case`
Update an existing test case
```json
{
  "name": "update_test_case",
  "description": "Update an existing test case",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Test case ID to update" },
      "updates": { "type": "object", "description": "Fields to update" }
    },
    "required": ["id", "updates"]
  }
}
```

#### `get_test_case`
Retrieve a specific test case
```json
{
  "name": "get_test_case",
  "description": "Get a test case by ID",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Test case ID" }
    },
    "required": ["id"]
  }
}
```

#### `list_test_cases`
List test cases with optional filtering
```json
{
  "name": "list_test_cases",
  "description": "List test cases with optional filters",
  "inputSchema": {
    "type": "object",
    "properties": {
      "suite": { "type": "string", "description": "Filter by test suite" },
      "priority": { "type": "string", "description": "Filter by priority" },
      "category": { "type": "string", "description": "Filter by category" },
      "status": { "type": "string", "description": "Filter by execution status" },
      "tags": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

#### `execute_test_suite`
Execute a test suite and update results
```json
{
  "name": "execute_test_suite",
  "description": "Execute tests and update results",
  "inputSchema": {
    "type": "object",
    "properties": {
      "suite": { "type": "string", "description": "Test suite to execute" },
      "browsers": { "type": "array", "items": { "type": "string" } },
      "tags": { "type": "array", "items": { "type": "string" } },
      "updateResults": { "type": "boolean", "default": true }
    },
    "required": ["suite"]
  }
}
```

#### `get_test_metrics`
Get test execution metrics and coverage
```json
{
  "name": "get_test_metrics",
  "description": "Get test execution metrics and coverage",
  "inputSchema": {
    "type": "object",
    "properties": {
      "timeframe": { "type": "string", "description": "Time period (day, week, month)" },
      "suite": { "type": "string", "description": "Specific test suite" }
    }
  }
}
```

#### `sync_with_monday`
Synchronize test cases with Monday.com
```json
{
  "name": "sync_with_monday",
  "description": "Sync test cases with Monday.com board",
  "inputSchema": {
    "type": "object",
    "properties": {
      "boardId": { "type": "string", "description": "Monday.com board ID" },
      "syncResults": { "type": "boolean", "description": "Include test results" }
    },
    "required": ["boardId"]
  }
}
```

### Resources

#### `test-registry`
Access to the complete test case registry
```json
{
  "uri": "test-registry://all",
  "name": "Complete Test Registry",
  "description": "Access to all test cases and metadata",
  "mimeType": "application/json"
}
```

#### `test-results`
Access to test execution results
```json
{
  "uri": "test-results://latest",
  "name": "Latest Test Results",
  "description": "Most recent test execution results",
  "mimeType": "application/json"
}
```

#### `test-coverage`
Test coverage analysis
```json
{
  "uri": "test-coverage://summary",
  "name": "Test Coverage Summary", 
  "description": "Test coverage analysis and gaps",
  "mimeType": "application/json"
}
```

## Implementation Example

### MCP Server (Node.js)
```javascript
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs').promises;
const path = require('path');

class TestCaseMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'test-case-manager',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    this.registryPath = path.join(__dirname, 'test-case-registry.json');
    this.setupHandlers();
  }

  setupHandlers() {
    // Tool handlers
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'create_test_case':
          return await this.createTestCase(args);
        case 'update_test_case':
          return await this.updateTestCase(args);
        case 'get_test_case':
          return await this.getTestCase(args);
        case 'list_test_cases':
          return await this.listTestCases(args);
        case 'execute_test_suite':
          return await this.executeTestSuite(args);
        case 'get_test_metrics':
          return await this.getTestMetrics(args);
        case 'sync_with_monday':
          return await this.syncWithMonday(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // Resource handlers
    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;
      
      switch (uri) {
        case 'test-registry://all':
          return await this.getTestRegistry();
        case 'test-results://latest':
          return await this.getLatestResults();
        case 'test-coverage://summary':
          return await this.getCoverageSummary();
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  async createTestCase(args) {
    const registry = await this.loadRegistry();
    
    // Add new test case to registry
    const suite = registry.testRegistry.testSuites[args.suite];
    if (!suite) {
      throw new Error(`Suite ${args.suite} not found`);
    }
    
    // Implementation details...
    
    await this.saveRegistry(registry);
    return { success: true, testCase: args };
  }

  async executeTestSuite(args) {
    const { spawn } = require('child_process');
    
    // Execute Playwright tests
    const command = `npx playwright test --project=${args.browsers?.join(',') || 'chromium'}`;
    
    return new Promise((resolve, reject) => {
      const process = spawn('npm', ['test'], { cwd: '../..' });
      
      process.on('close', async (code) => {
        // Parse results and update registry
        const results = await this.parseTestResults();
        resolve({ success: code === 0, results });
      });
    });
  }

  async syncWithMonday(args) {
    const { MondayTestIntegration } = require('./monday-integration');
    const integration = new MondayTestIntegration(
      process.env.MONDAY_API_TOKEN,
      args.boardId
    );
    
    await integration.syncTestCases();
    return { success: true };
  }
}

// Start server
const server = new TestCaseMCPServer();
const transport = new StdioServerTransport();
server.connect(transport);
```

## Usage Examples

### Adding a New Test Case via Claude
```
Claude, please create a new test case:
- ID: AUTH-003
- Name: "should handle Google OAuth login"
- Suite: e2e
- Priority: high
- Category: authentication
- Description: "Tests Google OAuth authentication flow"
- Steps: ["Click Google login", "Complete OAuth flow", "Verify user authenticated"]
```

### Running Tests and Updating Results
```
Claude, please run the e2e authentication tests and update the results in Monday.com
```

### Getting Test Coverage Analysis
```
Claude, show me the current test coverage gaps and suggest new test cases needed
```

## Benefits

1. **Seamless Integration**: Claude can directly manage test cases without manual file editing
2. **Real-time Updates**: Test results automatically sync with project management tools
3. **Intelligent Analysis**: Claude can analyze coverage gaps and suggest improvements
4. **Automated Reporting**: Generate test reports and metrics automatically
5. **Version Control**: All test case changes tracked in Git with proper commit messages

## Setup Instructions

1. **Install MCP SDK**:
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

2. **Configure Environment Variables**:
   ```bash
   export MONDAY_API_TOKEN="your_token"
   export MONDAY_BOARD_ID="your_board_id"
   ```

3. **Add to Claude Desktop Config**:
   ```json
   {
     "mcpServers": {
       "test-case-manager": {
         "command": "node",
         "args": ["tests/test-management/mcp-server.js"]
       }
     }
   }
   ```

4. **Run Test Management Commands**:
   ```bash
   # Sync test cases with Monday.com
   node tests/test-management/monday-integration.js

   # Start MCP server
   node tests/test-management/mcp-server.js
   ```

This creates a comprehensive test management system that integrates with Monday.com and provides Claude with direct access to test case management capabilities.