import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const cors = require('cors');

// Initialize Firebase Admin
admin.initializeApp();

// Configure CORS
const corsHandler = cors({ origin: true });

// Import function modules
import { generateImage } from './generate-image';
import { subscriptionCheckout } from './subscription-checkout';
import { subscriptionPortal } from './subscription-portal';
import { subscriptionUsage } from './subscription-usage';
import { subscriptionWebhook } from './subscription-webhook';

// Export HTTP functions
export const api = functions.https.onRequest((request, response): void => {
  return corsHandler(request, response, async () => {
    const path = request.path;
    const method = request.method;
    
    console.log(`🔥 Function called: ${method} ${path}`);
    console.log('Query params:', request.query);
    console.log('Headers:', Object.keys(request.headers));
    
    try {
      // Route requests to appropriate handlers
      // Firebase hosting strips /api prefix, so we get paths like /generate-image
      if (path === '/generate-image' || path.startsWith('/generate-image')) {
        console.log('🎯 Routing to generateImage');
        return await generateImage(request, response);
      } else if (path === '/subscription/checkout' || path.startsWith('/subscription/checkout')) {
        console.log('🎯 Routing to subscriptionCheckout');
        return await subscriptionCheckout(request, response);
      } else if (path === '/subscription/portal' || path.startsWith('/subscription/portal')) {
        console.log('🎯 Routing to subscriptionPortal');
        return await subscriptionPortal(request, response);
      } else if (path === '/subscription/usage' || path.startsWith('/subscription/usage')) {
        console.log('🎯 Routing to subscriptionUsage');
        return await subscriptionUsage(request, response);
      } else if (path === '/subscription/webhook' || path.startsWith('/subscription/webhook')) {
        console.log('🎯 Routing to subscriptionWebhook');
        return await subscriptionWebhook(request, response);
      } else {
        console.log(`❌ No route found for: ${method} ${path}`);
        response.status(404).json({ 
          error: 'Function not found',
          path: path,
          method: method,
          availableRoutes: ['/generate-image', '/subscription/checkout', '/subscription/portal', '/subscription/usage', '/subscription/webhook']
        });
      }
    } catch (error) {
      console.error('Function error:', error);
      response.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });
});