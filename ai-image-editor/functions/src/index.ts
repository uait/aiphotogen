import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();

// Configure CORS
const corsHandler = (cors as any)({ origin: true });

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
    
    try {
      // Route requests to appropriate handlers
      if (path.startsWith('/generate-image')) {
        return await generateImage(request, response);
      } else if (path.startsWith('/subscription/checkout')) {
        return await subscriptionCheckout(request, response);
      } else if (path.startsWith('/subscription/portal')) {
        return await subscriptionPortal(request, response);
      } else if (path.startsWith('/subscription/usage')) {
        return await subscriptionUsage(request, response);
      } else if (path.startsWith('/subscription/webhook')) {
        return await subscriptionWebhook(request, response);
      } else {
        response.status(404).json({ error: 'Function not found' });
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