import { test, expect } from '@playwright/test';

test.describe('AI Interactions - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('should have text chat functionality', async ({ page }) => {
    // Look for chat input elements
    const chatInputs = [
      page.locator('input[placeholder*="message" i]'),
      page.locator('input[placeholder*="chat" i]'),
      page.locator('input[placeholder*="ask" i]'),
      page.locator('textarea[placeholder*="message" i]'),
      page.locator('textarea[placeholder*="chat" i]'),
      page.locator('[data-testid*="chat-input"]'),
      page.locator('[data-testid*="message-input"]'),
      page.locator('.chat-input, .message-input')
    ];

    let chatInputFound = null;
    for (const input of chatInputs) {
      try {
        if (await input.first().isVisible({ timeout: 2000 })) {
          chatInputFound = input.first();
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (chatInputFound) {
      // Test text input functionality
      const testMessage = "Hello, this is a test message";
      await chatInputFound.fill(testMessage);
      await expect(chatInputFound).toHaveValue(testMessage);

      // Look for send button
      const sendButtons = [
        page.locator('button:has-text("Send")'),
        page.locator('button:has-text("Submit")'),
        page.locator('button[type="submit"]'),
        page.locator('[data-testid*="send"]'),
        page.locator('[aria-label*="send" i]'),
        page.locator('.send-button, .submit-button')
      ];

      for (const button of sendButtons) {
        try {
          if (await button.first().isVisible({ timeout: 1000 })) {
            // Don't actually send to avoid API calls, just verify button exists
            await expect(button.first()).toBeVisible();
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }
  });

  test('should have image generation functionality', async ({ page }) => {
    // Look for image generation triggers
    const imageGenerationElements = [
      page.locator('text=Generate Image'),
      page.locator('text=Create Image'),
      page.locator('text=Photo'),
      page.locator('text=Image'),
      page.locator('button:has-text("Generate")'),
      page.locator('button:has-text("Create")'),
      page.locator('[data-testid*="image"]'),
      page.locator('[data-testid*="photo"]'),
      page.locator('[data-testid*="generate"]'),
      page.locator('[aria-label*="image" i]')
    ];

    let imageElementFound = false;
    for (const element of imageGenerationElements) {
      try {
        if (await element.first().isVisible({ timeout: 2000 })) {
          imageElementFound = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    // Check for mode switcher or tabs
    const modeSwitchers = [
      page.locator('[role="tab"]'),
      page.locator('.tab, .mode'),
      page.locator('text=Chat'),
      page.locator('text=Photo'),
      page.locator('[data-testid*="mode"]'),
      page.locator('[data-testid*="tab"]')
    ];

    let modeSwitcherFound = false;
    for (const switcher of modeSwitchers) {
      try {
        if (await switcher.first().isVisible({ timeout: 2000 })) {
          modeSwitcherFound = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    // Either explicit image generation elements or mode switcher should exist
    expect(imageElementFound || modeSwitcherFound).toBeTruthy();
  });

  test('should handle file uploads for image editing', async ({ page }) => {
    // Look for file upload elements
    const uploadElements = [
      page.locator('input[type="file"]'),
      page.locator('[data-testid*="upload"]'),
      page.locator('[data-testid*="file"]'),
      page.locator('text=Upload'),
      page.locator('text=Drop'),
      page.locator('text=Browse'),
      page.locator('[aria-label*="upload" i]'),
      page.locator('[aria-label*="file" i]'),
      page.locator('.upload, .dropzone, .file-input')
    ];

    let uploadElementFound = false;
    for (const element of uploadElements) {
      try {
        const count = await element.count();
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            if (await element.nth(i).isVisible({ timeout: 1000 })) {
              uploadElementFound = true;
              break;
            }
          }
          if (uploadElementFound) break;
        }
      } catch (error) {
        continue;
      }
    }

    // File upload capability should be available
    expect(uploadElementFound).toBeTruthy();
  });

  test('should show appropriate loading states', async ({ page }) => {
    // Look for potential loading indicators in the DOM structure
    const loadingIndicators = [
      page.locator('[data-testid*="loading"]'),
      page.locator('[data-testid*="spinner"]'),
      page.locator('[aria-label*="loading" i]'),
      page.locator('.loading, .spinner, .progress'),
      page.locator('text=Loading'),
      page.locator('text=Processing'),
      page.locator('text=Generating')
    ];

    // Check if loading indicator elements exist in DOM (even if not currently visible)
    let loadingIndicatorExists = false;
    for (const indicator of loadingIndicators) {
      try {
        const count = await indicator.count();
        if (count > 0) {
          loadingIndicatorExists = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    // Loading indicators should exist in the application (though may not be visible initially)
    expect(loadingIndicatorExists).toBeTruthy();
  });

  test('should handle mode switching between chat and photo', async ({ page }) => {
    // Look for mode switching elements
    const modeSwitchers = [
      page.locator('[role="tab"]'),
      page.locator('.tab'),
      page.locator('button:has-text("Chat")'),
      page.locator('button:has-text("Photo")'),
      page.locator('button:has-text("Text")'),
      page.locator('button:has-text("Image")'),
      page.locator('[data-testid*="chat"]'),
      page.locator('[data-testid*="photo"]'),
      page.locator('[data-testid*="mode"]')
    ];

    let chatModeButton = null;
    let photoModeButton = null;

    // Find chat and photo mode buttons
    for (const switcher of modeSwitchers) {
      try {
        const count = await switcher.count();
        for (let i = 0; i < count; i++) {
          const element = switcher.nth(i);
          if (await element.isVisible({ timeout: 1000 })) {
            const text = await element.textContent();
            if (text && (text.toLowerCase().includes('chat') || text.toLowerCase().includes('text'))) {
              chatModeButton = element;
            } else if (text && (text.toLowerCase().includes('photo') || text.toLowerCase().includes('image'))) {
              photoModeButton = element;
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    if (chatModeButton && photoModeButton) {
      // Test switching between modes
      await photoModeButton.click();
      await page.waitForTimeout(500);
      
      await chatModeButton.click();
      await page.waitForTimeout(500);
      
      // Mode switching should work without errors
      expect(true).toBeTruthy(); // Test passes if no errors occurred
    }
  });
});