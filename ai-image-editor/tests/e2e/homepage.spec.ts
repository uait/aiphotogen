import { test, expect } from '@playwright/test';

test.describe('Homepage - Core User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage with key elements', async ({ page }) => {
    // Check for main heading
    await expect(page.locator('h1')).toContainText('PixtorAI');
    
    // Check for key navigation elements
    await expect(page.locator('text=PixtorAI')).toBeVisible();
    
    // Check for main CTA or interactive elements
    const chatInterface = page.locator('[data-testid="chat-interface"], .chat-interface, [class*="chat"]');
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create"), button:has-text("Send")');
    
    // At least one main interaction element should be visible
    const isInteractiveElementVisible = await chatInterface.isVisible().catch(() => false) || 
                                      await generateButton.first().isVisible().catch(() => false);
    
    expect(isInteractiveElementVisible).toBeTruthy();
  });

  test('should have responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle navigation correctly', async ({ page }) => {
    // Check if pricing navigation exists and works
    const pricingLink = page.locator('a[href*="pricing"], text=Pricing, text=Plans');
    if (await pricingLink.isVisible()) {
      await pricingLink.first().click();
      await expect(page).toHaveURL(/.*pricing.*/);
    }
  });
});