import { Page, expect } from '@playwright/test';

/**
 * Test helper utilities for PixtorAI application
 */

export class TestHelpers {
  
  /**
   * Check if authentication is required on current page
   */
  static async isAuthRequired(page: Page): Promise<boolean> {
    const authIndicators = [
      'text=Sign In',
      'text=Login', 
      'text=Account Required',
      'text=Please sign in',
      'text=Authentication required'
    ];
    
    for (const indicator of authIndicators) {
      try {
        if (await page.locator(indicator).first().isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  /**
   * Check if user appears to be authenticated
   */
  static async isUserAuthenticated(page: Page): Promise<boolean> {
    const userIndicators = [
      'text=Account',
      'text=Profile', 
      'text=Dashboard',
      'text=Settings',
      'text=Logout',
      'text=Sign Out',
      '[data-testid*="user"]',
      '[aria-label*="user"]'
    ];

    for (const indicator of userIndicators) {
      try {
        if (await page.locator(indicator).first().isVisible({ timeout: 2000 })) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  /**
   * Wait for page to be fully loaded and interactive
   */
  static async waitForPageReady(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Additional buffer for dynamic content
  }

  /**
   * Check if an element exists in DOM (regardless of visibility)
   */
  static async elementExists(page: Page, selector: string): Promise<boolean> {
    try {
      const count = await page.locator(selector).count();
      return count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Try multiple selectors and return the first visible one
   */
  static async findFirstVisible(page: Page, selectors: string[], timeout: number = 2000) {
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout })) {
          return element;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  /**
   * Check for console errors and filter out expected ones
   */
  static filterCriticalErrors(errors: string[]): string[] {
    return errors.filter(error => 
      !error.includes('mce-autosize-textarea') && // Known TinyMCE custom element error
      !error.includes('webcomponents-ce.js') &&   // Known webcomponents error  
      !error.toLowerCase().includes('network') &&  // Network errors during testing
      !error.toLowerCase().includes('cors') &&     // CORS errors during testing
      !error.toLowerCase().includes('favicon') &&  // Favicon not found errors
      !error.toLowerCase().includes('404')         // 404 errors for missing assets
    );
  }

  /**
   * Test responsive design at common breakpoints
   */
  static async testResponsiveBreakpoints(page: Page, callback?: () => Promise<void>): Promise<void> {
    const viewports = [
      { width: 1200, height: 800, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Basic check that page is still functional
      await expect(page.locator('body')).toBeVisible();
      
      // Run custom callback if provided
      if (callback) {
        await callback();
      }
    }
  }

  /**
   * Safe click that waits for element to be clickable
   */
  static async safeClick(page: Page, selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      const element = page.locator(selector).first();
      await element.waitFor({ state: 'visible', timeout });
      await element.click();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if any of multiple text patterns exist on page
   */
  static async hasAnyText(page: Page, textPatterns: string[], timeout: number = 2000): Promise<boolean> {
    for (const pattern of textPatterns) {
      try {
        if (await page.locator(`text=${pattern}`).first().isVisible({ timeout })) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }
}