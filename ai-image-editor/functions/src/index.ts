import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const cors = require('cors');

// Initialize Firebase Admin
admin.initializeApp();

// Configure CORS
const corsHandler = cors({ origin: true });

// Import function modules
import { subscriptionCheckout } from './subscription-checkout';
import { subscriptionPortal } from './subscription-portal';
import { subscriptionUsage } from './subscription-usage';
import { subscriptionWebhook } from './subscription-webhook';
import { memoryStats, memorySearch, memoryToggle, memoryExport, memoryClear, memoryContext } from './memory-api';
import { memoryEnhancedGenerate } from './memory-enhanced-generate';

// Export HTTP functions
export const api = functions.https.onRequest((request, response): void => {
  return corsHandler(request, response, async () => {
    const path = request.path;
    const method = request.method;
    
    console.log(`🔥 NEW VERSION - Function called: ${method} ${path}`);
    console.log('Query params:', request.query);
    console.log('Headers:', Object.keys(request.headers));
    
    try {
      // Route requests to appropriate handlers
      // Handle both /api/route and /route paths
      if (path === '/generate-image' || path === '/api/generate-image' || path.startsWith('/generate-image') || path.startsWith('/api/generate-image')) {
        console.log('🎯 Routing to memoryEnhancedGenerate');
        return await memoryEnhancedGenerate(request, response);
      } else if (path === '/generate-image-v2' || path === '/api/generate-image-v2' || path.startsWith('/generate-image-v2') || path.startsWith('/api/generate-image-v2')) {
        console.log('🎯 Routing to memoryEnhancedGenerate (v2)');
        return await memoryEnhancedGenerate(request, response);
      } else if (path === '/subscription/checkout' || path === '/api/subscription/checkout' || path.startsWith('/subscription/checkout') || path.startsWith('/api/subscription/checkout')) {
        console.log('🎯 Routing to subscriptionCheckout');
        return await subscriptionCheckout(request, response);
      } else if (path === '/subscription/portal' || path === '/api/subscription/portal' || path.startsWith('/subscription/portal') || path.startsWith('/api/subscription/portal')) {
        console.log('🎯 Routing to subscriptionPortal');
        return await subscriptionPortal(request, response);
      } else if (path === '/subscription/usage' || path === '/api/subscription/usage' || path.startsWith('/subscription/usage') || path.startsWith('/api/subscription/usage')) {
        console.log('🎯 Routing to subscriptionUsage');
        return await subscriptionUsage(request, response);
      } else if (path === '/subscription/webhook' || path === '/api/subscription/webhook' || path.startsWith('/subscription/webhook') || path.startsWith('/api/subscription/webhook')) {
        console.log('🎯 Routing to subscriptionWebhook');
        return await subscriptionWebhook(request, response);
      } else if (path === '/memory/stats' || path === '/api/memory/stats' || path.startsWith('/memory/stats') || path.startsWith('/api/memory/stats')) {
        console.log('🎯 Routing to memoryStats');
        return await memoryStats(request, response);
      } else if (path === '/memory/search' || path === '/api/memory/search' || path.startsWith('/memory/search') || path.startsWith('/api/memory/search')) {
        console.log('🎯 Routing to memorySearch');
        return await memorySearch(request, response);
      } else if (path === '/memory/toggle' || path === '/api/memory/toggle' || path.startsWith('/memory/toggle') || path.startsWith('/api/memory/toggle')) {
        console.log('🎯 Routing to memoryToggle');
        return await memoryToggle(request, response);
      } else if (path === '/memory/export' || path === '/api/memory/export' || path.startsWith('/memory/export') || path.startsWith('/api/memory/export')) {
        console.log('🎯 Routing to memoryExport');
        return await memoryExport(request, response);
      } else if (path === '/memory/clear' || path === '/api/memory/clear' || path.startsWith('/memory/clear') || path.startsWith('/api/memory/clear')) {
        console.log('🎯 Routing to memoryClear');
        return await memoryClear(request, response);
      } else if (path === '/memory/context' || path === '/api/memory/context' || path.startsWith('/memory/context') || path.startsWith('/api/memory/context')) {
        console.log('🎯 Routing to memoryContext');
        return await memoryContext(request, response);
      } else {
        console.log(`❌ No route found for: ${method} ${path}`);
        response.status(404).json({ 
          error: 'Function not found',
          path: path,
          method: method,
          availableRoutes: ['/api/generate-image', '/api/generate-image-v2', '/api/subscription/checkout', '/api/subscription/portal', '/api/subscription/usage', '/api/subscription/webhook', '/api/memory/stats', '/api/memory/search', '/api/memory/toggle', '/api/memory/export', '/api/memory/clear', '/api/memory/context']
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