const { test, expect } = require('@playwright/test');

// Simplified test for Usage Tracking functionality with authentication
test.describe('Usage Tracking System - Core Functionality', () => {
  
  // Helper function to login with test credentials
  async function loginWithTestAccount(page) {
    await page.goto('http://localhost:3000/app');
    
    // Wait for auth modal to appear
    await page.waitForSelector('[data-testid="auth-modal"]', { timeout: 10000 });
    
    // Fill in test credentials (ensure Email tab is selected)
    await page.fill('input[type="email"]', process.env.TEST_ACCOUNT_EMAIL || 'ashraf1190+testaccount@gmail.com');
    await page.fill('input[type="password"]', process.env.TEST_ACCOUNT_PASSWORD || 'Testaccount@12');
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for authentication to complete (auth modal to disappear)
    await page.waitForSelector('[data-testid="auth-modal"]', { state: 'detached', timeout: 15000 });
    
    // Navigate to app page manually since auth might redirect to landing page
    await page.goto('http://localhost:3000/app');
    
    // Wait for sidebar with usage indicator to appear
    await page.waitForSelector('[data-testid="usage-indicator"]', { timeout: 15000 });
    
    return true;
  }

  test.beforeEach(async ({ page }) => {
    // Set up test environment
    page.setDefaultTimeout(30000);
  });

  test('should authenticate and show usage tracking', async ({ page }) => {
    // Login with test account
    await loginWithTestAccount(page);
    
    // Verify sidebar is visible with usage information
    const usageIndicator = page.locator('[data-testid="usage-indicator"]');
    await expect(usageIndicator).toBeVisible();
    
    // Check usage text format - should show current usage
    const usageText = await usageIndicator.textContent();
    console.log('Usage text:', usageText);
    
    // Should match pattern like "X / Y" for used/limit
    expect(usageText).toMatch(/\d+\s*\/\s*\d+/);
    // Should show remaining count
    expect(usageText).toMatch(/\d+\s*left/);
    
    // Verify key usage elements
    await expect(page.locator('text=Today\'s Usage')).toBeVisible();
  });

  test('should show main chat interface', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Verify main chat interface elements are present
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    
    // Check that sidebar elements are present
    await expect(page.locator('text=New Chat')).toBeVisible();
  });

  test('should display user information in sidebar', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Check that test user email is displayed somewhere in sidebar
    const testEmail = process.env.TEST_ACCOUNT_EMAIL || 'ashraf1190+testaccount@gmail.com';
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
    
    // Should have logout button
    await expect(page.locator('text=Logout')).toBeVisible();
  });

  test('should test basic usage limit mock scenario', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Mock usage API to show limit reached
    await page.route('**/api/subscription/usage', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          today: {
            used: 5,
            limit: 5,
            remaining: 0
          },
          plan: {
            id: 'free',
            displayName: 'Free',
            dailyLimit: 5
          }
        })
      });
    });

    // Mock API to return limit exceeded
    await page.route('**/api/generate-image-v2', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Daily usage limit exceeded',
          errorType: 'USAGE_LIMIT_EXCEEDED',
          plan: {
            displayName: 'Free',
            dailyLimit: 5
          }
        })
      });
    });
    
    // Reload to get updated usage
    await page.reload();
    await page.waitForSelector('[data-testid="usage-indicator"]', { timeout: 15000 });
    
    // Check that usage shows 5/5
    const usageText = await page.locator('[data-testid="usage-indicator"]').textContent();
    expect(usageText).toContain('5 / 5');
    expect(usageText).toContain('0 left');
    
    // Try to send a message (should be blocked)
    await page.fill('[data-testid="chat-input"]', 'This should be blocked');
    await page.click('[data-testid="send-button"]');
    
    // Should show usage limit error
    await expect(page.locator('text=Daily usage limit exceeded')).toBeVisible({ timeout: 10000 });
  });

  test('should handle successful message sending with usage tracking', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Check initial usage
    const initialUsageText = await page.locator('[data-testid="usage-indicator"]').textContent();
    console.log('Initial usage:', initialUsageText);
    
    // Mock successful API response
    await page.route('**/api/generate-image-v2', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          text: 'This is a test response from the AI.',
          isImageGeneration: false,
          modelUsed: 'gemini-2.0-flash-exp',
          processingTimeMs: 1500
        })
      });
    });
    
    // Send a simple message
    await page.fill('[data-testid="chat-input"]', 'Hello, test message');
    await page.click('[data-testid="send-button"]');
    
    // Wait for user message to appear
    await expect(page.locator('text=Hello, test message')).toBeVisible({ timeout: 10000 });
    
    // Wait for AI response
    await expect(page.locator('text=This is a test response from the AI')).toBeVisible({ timeout: 15000 });
    
    console.log('Message successfully sent and received');
  });

  test('should maintain session after page refresh', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Verify initial state
    await expect(page.locator('[data-testid="usage-indicator"]')).toBeVisible();
    
    // Refresh the page
    await page.reload();
    
    // Should still be logged in - usage indicator should be visible
    await expect(page.locator('[data-testid="usage-indicator"]')).toBeVisible({ timeout: 15000 });
    
    // Chat interface should still be available
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  });

  test('should show appropriate progress indicators', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Get current usage to check progress bar
    const usageIndicator = page.locator('[data-testid="usage-indicator"]');
    await expect(usageIndicator).toBeVisible();
    
    // Should have a progress bar (visual indicator)
    const progressBar = page.locator('[data-testid="usage-indicator"] .h-1\\.5');
    await expect(progressBar).toBeVisible();
    
    console.log('Progress bar visible for usage tracking');
  });
});