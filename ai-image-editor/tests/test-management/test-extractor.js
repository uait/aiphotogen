/**
 * Test Case Extractor
 * 
 * Automatically extracts test case information from Playwright test files
 * and updates the test registry with structured test case data.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

class TestCaseExtractor {
  constructor(testDirectory = '../') {
    this.testDirectory = testDirectory;
    this.registry = {
      testRegistry: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        testSuites: {},
        metrics: {
          totalTestCases: 0,
          criticalTests: 0,
          highPriorityTests: 0,
          mediumPriorityTests: 0,
          browserCoverage: ['chrome', 'firefox', 'safari', 'mobile'],
          testCategories: [],
          lastExecutionSummary: null
        }
      }
    };
  }

  /**
   * Extract all test cases from test files
   */
  async extractAllTests() {
    const testFiles = await this.findTestFiles();
    
    console.log(`📊 Found ${testFiles.length} test files to analyze...`);

    for (const filePath of testFiles) {
      await this.extractTestsFromFile(filePath);
    }

    await this.updateMetrics();
    await this.saveRegistry();

    console.log(`✅ Extracted ${this.registry.testRegistry.metrics.totalTestCases} test cases`);
    return this.registry;
  }

  /**
   * Find all Playwright test files
   */
  async findTestFiles() {
    const testFiles = [];
    const extensions = ['.spec.ts', '.spec.js', '.test.ts', '.test.js'];

    const scanDirectory = async (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && entry.name !== 'node_modules') {
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const hasTestExtension = extensions.some(ext => entry.name.endsWith(ext));
          if (hasTestExtension) {
            testFiles.push(fullPath);
          }
        }
      }
    };

    await scanDirectory(this.testDirectory);
    return testFiles;
  }

  /**
   * Extract test cases from a specific file
   */
  async extractTestsFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      console.log(`🔍 Analyzing ${relativePath}...`);

      // Parse the file to AST
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      // Extract test information
      const testInfo = this.analyzeTestFile(ast, relativePath);
      
      if (testInfo.tests.length > 0) {
        this.addTestsToRegistry(testInfo, relativePath);
      }

    } catch (error) {
      console.warn(`⚠️  Could not parse ${filePath}: ${error.message}`);
    }
  }

  /**
   * Analyze test file AST to extract test cases
   */
  analyzeTestFile(ast, filePath) {
    const testInfo = {
      describes: [],
      tests: [],
      imports: [],
      beforeEach: []
    };

    let currentDescribe = null;
    let testCounter = 0;

    traverse(ast, {
      // Extract imports
      ImportDeclaration(path) {
        testInfo.imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.map(s => s.local.name)
        });
      },

      // Extract test.describe blocks
      CallExpression(path) {
        const { node } = path;
        
        const self = this;
        
        // Handle test.describe()
        if (self.isTestDescribe(node)) {
          const suiteName = self.getStringValue(node.arguments[0]);
          currentDescribe = {
            name: suiteName,
            tests: []
          };
          testInfo.describes.push(currentDescribe);
        }
        
        // Handle test() calls
        else if (self.isTestCall(node)) {
          const testName = self.getStringValue(node.arguments[0]);
          const testBody = node.arguments[1];
          
          testCounter++;
          const testCase = self.analyzeTestCase(
            testName, 
            testBody, 
            filePath, 
            testCounter,
            currentDescribe?.name
          );
          
          if (currentDescribe) {
            currentDescribe.tests.push(testCase);
          }
          testInfo.tests.push(testCase);
        }

        // Handle beforeEach
        else if (self.isBeforeEach(node)) {
          const beforeEachBody = self.analyzeBeforeEach(node.arguments[0]);
          testInfo.beforeEach.push(beforeEachBody);
        }
      }
    });

    return testInfo;
  }

  /**
   * Analyze individual test case
   */
  analyzeTestCase(testName, testBody, filePath, counter, describeName) {
    // Generate test ID based on file and describe block
    const filePrefix = this.generateTestPrefix(filePath);
    const testId = `${filePrefix}-${counter.toString().padStart(3, '0')}`;

    // Extract test steps and assertions from the test body
    const steps = this.extractTestSteps(testBody);
    const assertions = this.extractAssertions(testBody);

    // Determine priority based on keywords
    const priority = this.determinePriority(testName, steps);
    
    // Determine category
    const category = this.determineCategory(filePath, describeName, testName);

    // Extract tags
    const tags = this.extractTags(testName, filePath, steps);

    return {
      id: testId,
      name: testName,
      priority,
      category,
      description: this.generateDescription(testName, describeName, steps),
      prerequisites: this.extractPrerequisites(steps),
      steps: steps.map(step => step.description || step),
      expectedResult: this.generateExpectedResult(assertions, testName),
      browsers: ['chrome', 'firefox', 'safari', 'mobile'], // Default to all
      tags,
      file: filePath,
      describeName
    };
  }

  /**
   * Generate test ID prefix from file path
   */
  generateTestPrefix(filePath) {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Map file names to prefixes
    const prefixMap = {
      'homepage': 'HP',
      'authentication': 'AUTH',
      'ai-interactions': 'AI',
      'account-settings': 'ACC',
      'components': 'COMP'
    };

    return prefixMap[fileName] || fileName.toUpperCase().slice(0, 4);
  }

  /**
   * Extract test steps from test function body
   */
  extractTestSteps(testBody) {
    const steps = [];
    
    // This is a simplified version - would need more sophisticated AST analysis
    // for comprehensive step extraction
    
    if (testBody && testBody.body && testBody.body.body) {
      for (const statement of testBody.body.body) {
        if (statement.type === 'ExpressionStatement') {
          const step = this.analyzeStatement(statement);
          if (step) steps.push(step);
        }
      }
    }

    return steps.length > 0 ? steps : ['Navigate to page', 'Perform test actions', 'Verify results'];
  }

  /**
   * Analyze a statement to extract test step
   */
  analyzeStatement(statement) {
    if (statement.expression && statement.expression.type === 'AwaitExpression') {
      const call = statement.expression.argument;
      
      if (call && call.type === 'CallExpression') {
        // Handle page.goto()
        if (this.isPageGoto(call)) {
          const url = this.getStringValue(call.arguments[0]);
          return `Navigate to ${url}`;
        }
        
        // Handle page.click()
        if (this.isPageClick(call)) {
          const selector = this.getStringValue(call.arguments[0]);
          return `Click ${selector}`;
        }
        
        // Handle page.fill()
        if (this.isPageFill(call)) {
          const selector = this.getStringValue(call.arguments[0]);
          const value = this.getStringValue(call.arguments[1]);
          return `Fill ${selector} with "${value}"`;
        }
        
        // Handle expect()
        if (this.isExpect(call)) {
          return `Verify element or condition`;
        }
      }
    }
    
    return null;
  }

  /**
   * Determine test priority based on content
   */
  determinePriority(testName, steps) {
    const criticalKeywords = ['critical', 'login', 'auth', 'core', 'main', 'essential'];
    const highKeywords = ['important', 'key', 'primary', 'major'];
    
    const content = (testName + ' ' + steps.join(' ')).toLowerCase();
    
    if (criticalKeywords.some(keyword => content.includes(keyword))) {
      return 'critical';
    } else if (highKeywords.some(keyword => content.includes(keyword))) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Determine test category
   */
  determineCategory(filePath, describeName, testName) {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    const categoryMap = {
      'homepage': 'smoke',
      'authentication': 'authentication',
      'ai-interactions': 'core-feature',
      'account-settings': 'account',
      'components': 'ui-component'
    };

    return categoryMap[fileName] || 'functional';
  }

  /**
   * Extract tags from test information
   */
  extractTags(testName, filePath, steps) {
    const tags = [];
    const content = (testName + ' ' + steps.join(' ')).toLowerCase();
    
    // Add file-based tags
    if (filePath.includes('e2e')) tags.push('e2e');
    if (filePath.includes('functional')) tags.push('functional');
    
    // Add content-based tags
    if (content.includes('responsive')) tags.push('responsive');
    if (content.includes('mobile')) tags.push('mobile');
    if (content.includes('auth')) tags.push('auth');
    if (content.includes('api')) tags.push('api');
    if (content.includes('ui')) tags.push('ui');
    if (content.includes('smoke')) tags.push('smoke');
    
    return tags;
  }

  /**
   * Helper methods for AST node type checking
   */
  isTestDescribe(node) {
    return node.callee && 
           node.callee.object && 
           node.callee.object.name === 'test' &&
           node.callee.property && 
           node.callee.property.name === 'describe';
  }

  isTestCall(node) {
    return (node.callee && node.callee.name === 'test') ||
           (node.callee && node.callee.object && node.callee.object.name === 'test' && 
            !node.callee.property);
  }

  isBeforeEach(node) {
    return node.callee && 
           node.callee.object && 
           node.callee.object.name === 'test' &&
           node.callee.property && 
           node.callee.property.name === 'beforeEach';
  }

  isPageGoto(call) {
    return call.callee && 
           call.callee.object && 
           call.callee.object.name === 'page' &&
           call.callee.property && 
           call.callee.property.name === 'goto';
  }

  isPageClick(call) {
    return call.callee && 
           call.callee.object && 
           call.callee.object.name === 'page' &&
           call.callee.property && 
           call.callee.property.name === 'click';
  }

  isPageFill(call) {
    return call.callee && 
           call.callee.object && 
           call.callee.object.name === 'page' &&
           call.callee.property && 
           call.callee.property.name === 'fill';
  }

  isExpect(call) {
    return call.callee && call.callee.name === 'expect';
  }

  /**
   * Get string value from AST node
   */
  getStringValue(node) {
    if (node && node.type === 'StringLiteral') {
      return node.value;
    } else if (node && node.type === 'TemplateLiteral') {
      return node.quasis.map(q => q.value.cooked).join('${...}');
    }
    return 'Unknown';
  }

  /**
   * Generate test description
   */
  generateDescription(testName, describeName, steps) {
    const suite = describeName ? `${describeName}: ` : '';
    return `${suite}${testName}. Steps: ${steps.slice(0, 3).join(', ')}${steps.length > 3 ? '...' : ''}`;
  }

  /**
   * Generate expected result from assertions
   */
  generateExpectedResult(assertions, testName) {
    if (assertions && assertions.length > 0) {
      return assertions.join(' and ');
    }
    return `${testName} should complete successfully`;
  }

  /**
   * Extract prerequisites from steps
   */
  extractPrerequisites(steps) {
    const prereqs = [];
    
    steps.forEach(step => {
      if (typeof step === 'string' && step.includes('Navigate to')) {
        prereqs.push('Page must be accessible');
      }
    });

    return prereqs.length > 0 ? prereqs.join(', ') : 'None';
  }

  /**
   * Add extracted tests to registry
   */
  addTestsToRegistry(testInfo, filePath) {
    // Determine suite and group from file path
    const pathParts = filePath.split('/');
    const suiteType = pathParts.includes('e2e') ? 'e2e' : 'functional';
    const fileName = path.basename(filePath, path.extname(filePath));

    // Initialize suite if not exists
    if (!this.registry.testRegistry.testSuites[suiteType]) {
      this.registry.testRegistry.testSuites[suiteType] = {
        name: suiteType === 'e2e' ? 'End-to-End Tests' : 'Functional Component Tests',
        description: suiteType === 'e2e' ? 'Complete user journey testing' : 'Component functionality testing',
        testCases: {}
      };
    }

    // Add test cases to registry
    this.registry.testRegistry.testSuites[suiteType].testCases[fileName] = {
      file: filePath,
      testCases: testInfo.tests
    };
  }

  /**
   * Update registry metrics
   */
  async updateMetrics() {
    let totalTests = 0;
    let criticalTests = 0;
    let highPriorityTests = 0;
    let mediumPriorityTests = 0;
    const categories = new Set();

    // Count tests and priorities
    for (const suite of Object.values(this.registry.testRegistry.testSuites)) {
      for (const group of Object.values(suite.testCases)) {
        totalTests += group.testCases.length;
        
        group.testCases.forEach(test => {
          categories.add(test.category);
          switch (test.priority) {
            case 'critical': criticalTests++; break;
            case 'high': highPriorityTests++; break;
            case 'medium': mediumPriorityTests++; break;
          }
        });
      }
    }

    this.registry.testRegistry.metrics = {
      ...this.registry.testRegistry.metrics,
      totalTestCases: totalTests,
      criticalTests,
      highPriorityTests,
      mediumPriorityTests,
      testCategories: Array.from(categories)
    };
  }

  /**
   * Save registry to file
   */
  async saveRegistry() {
    const registryPath = path.join(__dirname, 'test-case-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(this.registry, null, 2));
    console.log(`💾 Registry saved to ${registryPath}`);
  }
}

// Main execution
async function main() {
  const extractor = new TestCaseExtractor();
  await extractor.extractAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { TestCaseExtractor };