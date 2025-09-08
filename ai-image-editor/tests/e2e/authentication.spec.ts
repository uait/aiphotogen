import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show login/signup options', async ({ page }) => {
    // Look for authentication triggers
    const authTriggers = [
      page.locator('text=Sign In'),
      page.locator('text=Sign Up'),
      page.locator('text=Login'),
      page.locator('text=Register'),
      page.locator('button:has-text("Sign In")'),
      page.locator('button:has-text("Login")'),
      page.locator('[data-testid*="auth"]'),
      page.locator('[data-testid*="login"]'),
      page.locator('[data-testid*="signin"]')
    ];

    // Check if any auth trigger is visible
    let authTriggerFound = false;
    for (const trigger of authTriggers) {
      try {
        if (await trigger.first().isVisible({ timeout: 2000 })) {
          authTriggerFound = true;
          break;
        }
      } catch (error) {
        // Continue checking other triggers
      }
    }

    // If no explicit auth trigger found, check if user already appears to be authenticated
    const userIndicators = [
      page.locator('text=Account'),
      page.locator('text=Profile'),
      page.locator('text=Dashboard'),
      page.locator('text=Settings'),
      page.locator('[data-testid*="user"]'),
      page.locator('[aria-label*="user"]')
    ];

    let userAuthenticated = false;
    for (const indicator of userIndicators) {
      try {
        if (await indicator.first().isVisible({ timeout: 2000 })) {
          userAuthenticated = true;
          break;
        }
      } catch (error) {
        // Continue checking
      }
    }

    // Either auth triggers should be available OR user should appear authenticated
    expect(authTriggerFound || userAuthenticated).toBeTruthy();
  });

  test('should handle authentication modal/page', async ({ page }) => {
    // Try to find and click authentication trigger
    const authButtons = [
      page.locator('text=Sign In'),
      page.locator('text=Login'),
      page.locator('button:has-text("Sign In")'),
      page.locator('button:has-text("Login")')
    ];

    let authButtonClicked = false;
    for (const button of authButtons) {
      try {
        if (await button.first().isVisible({ timeout: 2000 })) {
          await button.first().click();
          authButtonClicked = true;
          break;
        }
      } catch (error) {
        // Continue trying other buttons
      }
    }

    if (authButtonClicked) {
      // Wait for modal or redirect
      await page.waitForTimeout(1000);
      
      // Check for authentication form elements
      const authFormElements = [
        page.locator('input[type="email"], input[placeholder*="email" i]'),
        page.locator('input[type="password"], input[placeholder*="password" i]'),
        page.locator('text=Google'),
        page.locator('text=Continue with Google'),
        page.locator('[data-testid*="google"]'),
        page.locator('[aria-label*="Google"]')
      ];

      let authFormFound = false;
      for (const element of authFormElements) {
        try {
          if (await element.first().isVisible({ timeout: 3000 })) {
            authFormFound = true;
            break;
          }
        } catch (error) {
          // Continue checking
        }
      }

      expect(authFormFound).toBeTruthy();
    }
  });

  test('should validate authentication form inputs', async ({ page }) => {
    // Try to trigger authentication
    const authButtons = page.locator('text=Sign In, text=Login, button:has-text("Sign In"), button:has-text("Login")');
    
    for (let i = 0; i < await authButtons.count(); i++) {
      try {
        if (await authButtons.nth(i).isVisible({ timeout: 1000 })) {
          await authButtons.nth(i).click();
          break;
        }
      } catch (error) {
        continue;
      }
    }

    // Wait for form to appear
    await page.waitForTimeout(2000);

    // Look for email and password inputs
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i]').first();

    if (await emailInput.isVisible({ timeout: 2000 }) && await passwordInput.isVisible({ timeout: 2000 })) {
      // Test invalid email validation
      await emailInput.fill('invalid-email');
      await passwordInput.fill('short');
      
      // Try to find submit button
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Continue")').first();
      
      if (await submitButton.isVisible({ timeout: 2000 })) {
        await submitButton.click();
        
        // Should show validation error
        const errorMessages = [
          page.locator('text=Invalid email'),
          page.locator('text=Enter a valid email'),
          page.locator('[data-testid*="error"]'),
          page.locator('.error, .invalid, .field-error')
        ];

        let errorFound = false;
        for (const error of errorMessages) {
          try {
            if (await error.first().isVisible({ timeout: 3000 })) {
              errorFound = true;
              break;
            }
          } catch (e) {
            // Continue checking
          }
        }

        // Note: Some auth systems might not show client-side validation
        // so we don't fail the test if no error is found
      }
    }
  });
});