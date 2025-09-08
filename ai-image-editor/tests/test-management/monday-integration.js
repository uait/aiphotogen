/**
 * Monday.com Integration for Test Case Management
 * 
 * This script integrates Playwright test results with Monday.com boards
 * to automatically create and update test case items.
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class MondayTestIntegration {
  constructor(apiToken, boardId) {
    this.apiToken = apiToken;
    this.boardId = boardId;
    this.apiUrl = 'https://api.monday.com/v2';
  }

  /**
   * Create a Monday.com GraphQL query
   */
  async query(query, variables = {}) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiToken
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Monday.com API Error: ${data.errors.map(e => e.message).join(', ')}`);
    }

    return data.data;
  }

  /**
   * Create test case items in Monday.com from test registry
   */
  async syncTestCases() {
    const registryPath = path.join(__dirname, 'test-case-registry.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    console.log('🔄 Syncing test cases with Monday.com...');

    for (const [suiteKey, suite] of Object.entries(registry.testRegistry.testSuites)) {
      for (const [groupKey, group] of Object.entries(suite.testCases)) {
        for (const testCase of group.testCases) {
          await this.createOrUpdateTestCase(testCase, suiteKey, groupKey);
        }
      }
    }

    console.log('✅ Test case sync completed');
  }

  /**
   * Create or update a test case item in Monday.com
   */
  async createOrUpdateTestCase(testCase, suite, group) {
    // Check if item already exists
    const existingItem = await this.findItemByTestId(testCase.id);

    if (existingItem) {
      console.log(`📝 Updating test case: ${testCase.id}`);
      await this.updateTestCaseItem(existingItem.id, testCase);
    } else {
      console.log(`➕ Creating test case: ${testCase.id}`);
      await this.createTestCaseItem(testCase, suite, group);
    }
  }

  /**
   * Find existing Monday.com item by test ID
   */
  async findItemByTestId(testId) {
    const query = `
      query ($boardId: ID!) {
        boards (ids: [$boardId]) {
          items {
            id
            name
            column_values {
              id
              text
            }
          }
        }
      }
    `;

    const data = await this.query(query, { boardId: this.boardId });
    const items = data.boards[0]?.items || [];

    return items.find(item => 
      item.column_values.some(col => col.text === testId)
    );
  }

  /**
   * Create a new test case item in Monday.com
   */
  async createTestCaseItem(testCase, suite, group) {
    const query = `
      mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item (
          board_id: $boardId, 
          item_name: $itemName, 
          column_values: $columnValues
        ) {
          id
        }
      }
    `;

    const columnValues = {
      // Customize these column IDs based on your Monday.com board structure
      "test_id": testCase.id,
      "priority": testCase.priority,
      "category": testCase.category,
      "status": "Not Started",
      "suite": suite,
      "browsers": testCase.browsers.join(', '),
      "tags": testCase.tags.join(', '),
      "description": testCase.description,
      "last_result": "Not Run"
    };

    await this.query(query, {
      boardId: this.boardId,
      itemName: `${testCase.id}: ${testCase.name}`,
      columnValues: JSON.stringify(columnValues)
    });
  }

  /**
   * Update test results in Monday.com after test execution
   */
  async updateTestResults(results) {
    console.log('🔄 Updating test results in Monday.com...');

    for (const result of results) {
      const item = await this.findItemByTestId(result.testId);
      if (item) {
        await this.updateTestResult(item.id, result);
      }
    }

    console.log('✅ Test results updated');
  }

  /**
   * Update a specific test result
   */
  async updateTestResult(itemId, result) {
    const query = `
      mutation ($itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values (
          item_id: $itemId, 
          column_values: $columnValues
        ) {
          id
        }
      }
    `;

    const columnValues = {
      "status": result.status, // "Passed", "Failed", "Skipped"
      "last_result": result.result,
      "last_execution": new Date().toISOString(),
      "execution_time": result.duration,
      "error_message": result.error || ""
    };

    await this.query(query, {
      itemId,
      columnValues: JSON.stringify(columnValues)
    });
  }

  /**
   * Create test execution summary
   */
  async createExecutionSummary(summary) {
    const query = `
      mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item (
          board_id: $boardId, 
          item_name: $itemName, 
          column_values: $columnValues
        ) {
          id
        }
      }
    `;

    const columnValues = {
      "type": "execution-summary",
      "total_tests": summary.total,
      "passed": summary.passed,
      "failed": summary.failed,
      "skipped": summary.skipped,
      "duration": summary.duration,
      "execution_date": new Date().toISOString()
    };

    await this.query(query, {
      boardId: this.boardId,
      itemName: `Test Execution - ${new Date().toLocaleDateString()}`,
      columnValues: JSON.stringify(columnValues)
    });
  }
}

/**
 * Parse Playwright test results and format for Monday.com
 */
function parsePlaywrightResults(resultsPath) {
  // This would parse the Playwright JSON report
  // and extract test results with their IDs
  
  // Example structure:
  return [
    {
      testId: 'HP-001',
      status: 'Passed',
      result: 'Test completed successfully',
      duration: '2.3s',
      error: null
    },
    // ... more results
  ];
}

/**
 * Main execution function
 */
async function main() {
  const apiToken = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;

  if (!apiToken || !boardId) {
    console.error('❌ Please set MONDAY_API_TOKEN and MONDAY_BOARD_ID environment variables');
    process.exit(1);
  }

  const integration = new MondayTestIntegration(apiToken, boardId);

  try {
    // Sync test cases from registry
    await integration.syncTestCases();

    // If test results are provided, update them
    if (process.argv[2]) {
      const results = parsePlaywrightResults(process.argv[2]);
      await integration.updateTestResults(results);
    }

    console.log('🎉 Monday.com integration completed successfully');
  } catch (error) {
    console.error('❌ Integration failed:', error.message);
    process.exit(1);
  }
}

// Export for use as module or run directly
if (require.main === module) {
  main();
}

module.exports = {
  MondayTestIntegration,
  parsePlaywrightResults
};