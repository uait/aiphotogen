const { test, expect } = require('@playwright/test');

// Test suite for Usage Tracking functionality with authentication
test.describe('Usage Tracking System with Authentication', () => {
  
  // Helper function to login with test credentials
  async function loginWithTestAccount(page) {
    await page.goto('http://localhost:3000/app');
    
    // Wait for auth modal to appear
    await page.waitForSelector('[data-testid="auth-modal"]', { timeout: 10000 });
    
    // Click on email sign in tab if not already active
    const emailTab = page.locator('text=Email');
    if (await emailTab.isVisible()) {
      await emailTab.click();
    }
    
    // Fill in test credentials
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

  test('should authenticate and show usage tracking in sidebar', async ({ page }) => {
    // Login with test account
    await loginWithTestAccount(page);
    
    // Verify sidebar is visible with usage information
    await expect(page.locator('[data-testid="usage-indicator"]')).toBeVisible();
    
    // Check usage text format
    const usageText = await page.locator('[data-testid="usage-indicator"]').textContent();
    expect(usageText).toMatch(/\d+\s*\/\s*\d+/); // Should match pattern like "0 / 50"
    expect(usageText).toMatch(/\d+\s*left/); // Should show remaining count
    
    // Verify usage elements
    await expect(page.locator('text=Today\'s Usage')).toBeVisible();
    await expect(page.locator('[data-testid="usage-indicator"] >> text=left')).toBeVisible();
  });

  test('should show chat interface elements after login', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Verify main chat interface elements
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    
    // Check tabs (be more specific to avoid multiple matches)
    await expect(page.locator('button').filter({ hasText: 'Chat' }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Photo' }).first()).toBeVisible();
    
    // Check sidebar elements
    await expect(page.locator('text=New Chat')).toBeVisible();
    await expect(page.locator('text=Text Chats')).toBeVisible();
    await expect(page.locator('text=Image Chats')).toBeVisible();
  });

  test('should navigate to account settings', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Find and click account/settings link
    const settingsLink = page.locator('text=Account').or(page.locator('[href="/account"]')).first();
    await settingsLink.click();
    
    // Should navigate to account page
    await page.waitForURL('**/account');
    await expect(page.locator('text=Back to PixtorAI')).toBeVisible();
  });

  test('should navigate to pricing page', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Click pricing link
    const pricingLink = page.locator('text=Pricing').or(page.locator('[href="/pricing"]')).first();
    await pricingLink.click();
    
    // Should navigate to pricing page
    await page.waitForURL('**/pricing');
    await expect(page.locator('text=Back to PixtorAI')).toBeVisible();
    
    // Verify pricing plans are displayed
    await expect(page.locator('text=Free')).toBeVisible();
    await expect(page.locator('text=Starter')).toBeVisible();
    await expect(page.locator('text=Creator')).toBeVisible();
    await expect(page.locator('text=Pro')).toBeVisible();
  });

  test('should send a text message and receive response', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Get initial usage count
    const initialUsageText = await page.locator('[data-testid="usage-indicator"]').textContent();
    const initialUsed = parseInt(initialUsageText.match(/(\d+)\s*\/\s*\d+/)[1]);
    
    // Send a simple text message
    await page.fill('[data-testid="chat-input"]', 'Hello, this is a test message');
    await page.click('[data-testid="send-button"]');
    
    // Wait for response
    await page.waitForSelector('text=Hello, this is a test message', { timeout: 15000 });
    
    // Should see loading indicator
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 5000 });
    
    // Wait for response to complete (loading to disappear)
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 30000 });
    
    // Verify usage has been updated (may take up to 30 seconds due to periodic refresh)
    await page.waitForTimeout(35000);
    
    const updatedUsageText = await page.locator('[data-testid="usage-indicator"]').textContent();
    const updatedUsed = parseInt(updatedUsageText.match(/(\d+)\s*\/\s*\d+/)[1]);
    
    expect(updatedUsed).toBeGreaterThan(initialUsed);
  });

  test('should handle photo mode switching', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Switch to Photo mode
    await page.click('text=Photo');
    
    // Verify photo mode interface
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    
    // Should have file upload options visible
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test('should show user information in sidebar', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Check that user email/info is displayed in sidebar
    const testEmail = process.env.TEST_ACCOUNT_EMAIL || 'ashraf1190+testaccount@gmail.com';
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
    
    // Should have logout button
    await expect(page.locator('text=Logout')).toBeVisible();
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Refresh the page
    await page.reload();
    
    // Should still be logged in - usage indicator should be visible
    await expect(page.locator('[data-testid="usage-indicator"]')).toBeVisible({ timeout: 15000 });
    
    // Chat interface should still be available
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  });

  test('should handle logout correctly', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Click logout button
    await page.click('text=Logout');
    
    // Should redirect to login or show auth modal
    await page.waitForTimeout(2000);
    
    // Should either be on landing page or show auth modal
    const isOnLanding = await page.locator('text=Welcome to PixtorAI').isVisible();
    const hasAuthModal = await page.locator('[data-testid="auth-modal"]').isVisible();
    
    expect(isOnLanding || hasAuthModal).toBeTruthy();
  });

  test('should show conversation history', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Send a message to create conversation
    await page.fill('[data-testid="chat-input"]', 'Test conversation message');
    await page.click('[data-testid="send-button"]');
    
    // Wait for message to appear
    await page.waitForSelector('text=Test conversation message', { timeout: 15000 });
    
    // Wait for response to complete
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 30000 });
    
    // Check if conversation appears in sidebar (may take a moment)
    await page.waitForTimeout(3000);
    
    // Should see some text in the conversation list
    const hasTextChats = await page.locator('text=Text Chats').isVisible();
    expect(hasTextChats).toBeTruthy();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Mock API to return error
    await page.route('**/api/generate-image-v2', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Test error message',
          success: false
        })
      });
    });
    
    // Send a message
    await page.fill('[data-testid="chat-input"]', 'This should fail');
    await page.click('[data-testid="send-button"]');
    
    // Should show error message
    await expect(page.locator('text=Failed to send message')).toBeVisible({ timeout: 10000 });
  });

  test('should test usage limit blocking', async ({ page }) => {
    await loginWithTestAccount(page);
    
    // Mock usage API to show limit reached
    await page.route('**/api/subscription/usage', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          today: {
            used: 50,
            limit: 50,
            remaining: 0
          },
          plan: {
            id: 'starter',
            displayName: 'Starter',
            dailyLimit: 50
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
            displayName: 'Starter',
            dailyLimit: 50
          }
        })
      });
    });
    
    // Reload to get updated usage
    await page.reload();
    await page.waitForSelector('[data-testid="usage-indicator"]', { timeout: 15000 });
    
    // Try to send a message
    await page.fill('[data-testid="chat-input"]', 'This should be blocked');
    await page.click('[data-testid="send-button"]');
    
    // Should show usage limit error and upgrade prompt
    await expect(page.locator('text=Daily usage limit exceeded')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Daily Limit Reached')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Upgrade Plan')).toBeVisible();
  });

  test('should verify responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await loginWithTestAccount(page);
    
    // Mobile sidebar should be hidden initially
    const sidebar = page.locator('.lg\\:translate-x-0');
    await expect(sidebar).toHaveClass(/translate-x-full/);
    
    // Should have mobile menu button
    const menuButton = page.locator('button >> svg').first();
    await expect(menuButton).toBeVisible();
    
    // Click to open sidebar
    await menuButton.click();
    
    // Sidebar should be visible now
    await expect(sidebar).toHaveClass(/translate-x-0/);
    
    // Usage indicator should still be visible
    await expect(page.locator('[data-testid="usage-indicator"]')).toBeVisible();
  });
});

// Additional helper functions for complex test scenarios
async function waitForAuthComplete(page) {
  try {
    // Wait for either sidebar (authenticated) or auth modal (not authenticated)
    await page.waitForSelector('[data-testid="usage-indicator"], [data-testid="auth-modal"]', { timeout: 10000 });
    return await page.locator('[data-testid="usage-indicator"]').isVisible();
  } catch {
    return false;
  }
}

async function createTestConversation(page, message = 'Test conversation') {
  await page.fill('[data-testid="chat-input"]', message);
  await page.click('[data-testid="send-button"]');
  await page.waitForSelector(`text=${message}`, { timeout: 15000 });
  await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 30000 });
}