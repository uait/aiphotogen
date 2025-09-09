const { test, expect } = require('@playwright/test');

test.describe('Debug Authentication', () => {
  test('debug authentication flow', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000/app');
    
    // Wait a moment for page to load
    await page.waitForTimeout(3000);
    
    // Take a screenshot to see current state
    await page.screenshot({ path: 'debug-initial-state.png', fullPage: true });
    
    // Check if auth modal is visible
    const authModal = page.locator('[data-testid="auth-modal"]');
    const isAuthModalVisible = await authModal.isVisible();
    console.log('Auth modal visible:', isAuthModalVisible);
    
    if (isAuthModalVisible) {
      // Try to find email input
      const emailInput = page.locator('input[type="email"]');
      const isEmailInputVisible = await emailInput.isVisible();
      console.log('Email input visible:', isEmailInputVisible);
      
      if (isEmailInputVisible) {
        // Fill in credentials
        const testEmail = process.env.TEST_ACCOUNT_EMAIL || 'ashraf1190+testaccount@gmail.com';
        const testPassword = process.env.TEST_ACCOUNT_PASSWORD || 'Testaccount@12';
        
        console.log('Using test credentials:', testEmail);
        
        await emailInput.fill(testEmail);
        await page.locator('input[type="password"]').fill(testPassword);
        
        // Take screenshot before submitting
        await page.screenshot({ path: 'debug-before-submit.png', fullPage: true });
        
        // Submit form
        await page.click('button[type="submit"]');
        
        // Wait for response and page to settle
        await page.waitForTimeout(8000);
        
        // Take screenshot after submit
        await page.screenshot({ path: 'debug-after-submit.png', fullPage: true });
        
        // Check what happened
        const isStillOnModal = await authModal.isVisible();
        console.log('Still showing auth modal:', isStillOnModal);
        
        // Check for any error messages
        const errorMessages = await page.locator('text=error, text=Error, text=invalid, text=Invalid').allTextContents();
        console.log('Error messages found:', errorMessages);
        
        // If auth modal is gone, check for other elements
        if (!isStillOnModal) {
          console.log('Authentication successful, checking for UI elements...');
          
          // Check for sidebar
          const sidebar = page.locator('text=New Chat');
          const isSidebarVisible = await sidebar.isVisible();
          console.log('Sidebar (New Chat button) visible:', isSidebarVisible);
          
          // Check for chat interface
          const chatInput = page.locator('[data-testid="chat-input"]');
          const isChatInputVisible = await chatInput.isVisible();
          console.log('Chat input visible:', isChatInputVisible);
          
          // Check for send button
          const sendButton = page.locator('[data-testid="send-button"]');
          const isSendButtonVisible = await sendButton.isVisible();
          console.log('Send button visible:', isSendButtonVisible);
          
          // Wait a bit more for usage indicator to load
          await page.waitForTimeout(5000);
        }
        
        // Check if we're now authenticated
        const usageIndicator = page.locator('[data-testid="usage-indicator"]');
        const isUsageVisible = await usageIndicator.isVisible();
        console.log('Usage indicator visible:', isUsageVisible);
        
        // If still not visible, check all elements on page
        if (!isUsageVisible) {
          const currentURL = page.url();
          console.log('Current URL after auth:', currentURL);
          
          const allTestIds = await page.locator('[data-testid]').allTextContents();
          console.log('All elements with data-testid:', allTestIds);
          
          // Check for any text with "Usage" or "Today"
          const usageTexts = await page.locator('text=Usage, text=Today').allTextContents();
          console.log('Elements with Usage/Today text:', usageTexts);
          
          // Check page title and main content
          const pageTitle = await page.title();
          console.log('Page title:', pageTitle);
          
          // Check for any visible text content
          const bodyText = await page.locator('body').textContent();
          console.log('Body text (first 200 chars):', bodyText?.substring(0, 200));
          
          // Check if we're on landing page
          const welcomeText = page.locator('text=Welcome to PixtorAI');
          const isOnLanding = await welcomeText.isVisible();
          console.log('On landing page (Welcome text visible):', isOnLanding);
          
          // Try waiting for URL change or navigation
          console.log('Waiting for potential navigation...');
          await page.waitForTimeout(3000);
          
          const newURL = page.url();
          console.log('URL after waiting:', newURL);
          
          // Check for app elements again
          const chatInputAfterWait = page.locator('[data-testid="chat-input"]');
          const isChatInputVisibleAfterWait = await chatInputAfterWait.isVisible();
          console.log('Chat input visible after waiting:', isChatInputVisibleAfterWait);
        }
      }
    } else {
      // Maybe already logged in, or on different page
      const currentURL = page.url();
      console.log('Current URL:', currentURL);
      
      // Check if we're on landing page
      const welcomeText = page.locator('text=Welcome to PixtorAI');
      const isOnLanding = await welcomeText.isVisible();
      console.log('On landing page:', isOnLanding);
      
      // Check if usage indicator exists anywhere
      const usageIndicator = page.locator('[data-testid="usage-indicator"]');
      const isUsageVisible = await usageIndicator.isVisible();
      console.log('Usage indicator visible:', isUsageVisible);
    }
    
    // Final screenshot
    await page.screenshot({ path: 'debug-final-state.png', fullPage: true });
  });
});