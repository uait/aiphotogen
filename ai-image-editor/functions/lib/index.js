"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors = require('cors');
// Initialize Firebase Admin
admin.initializeApp();
// Configure CORS
const corsHandler = cors({ origin: true });
// Import function modules
const generate_image_1 = require("./generate-image");
const subscription_checkout_1 = require("./subscription-checkout");
const subscription_portal_1 = require("./subscription-portal");
const subscription_usage_1 = require("./subscription-usage");
const subscription_webhook_1 = require("./subscription-webhook");
// Export HTTP functions
exports.api = functions.https.onRequest((request, response) => {
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
                console.log('🎯 Routing to generateImage');
                return await (0, generate_image_1.generateImage)(request, response);
            }
            else if (path === '/subscription/checkout' || path === '/api/subscription/checkout' || path.startsWith('/subscription/checkout') || path.startsWith('/api/subscription/checkout')) {
                console.log('🎯 Routing to subscriptionCheckout');
                return await (0, subscription_checkout_1.subscriptionCheckout)(request, response);
            }
            else if (path === '/subscription/portal' || path === '/api/subscription/portal' || path.startsWith('/subscription/portal') || path.startsWith('/api/subscription/portal')) {
                console.log('🎯 Routing to subscriptionPortal');
                return await (0, subscription_portal_1.subscriptionPortal)(request, response);
            }
            else if (path === '/subscription/usage' || path === '/api/subscription/usage' || path.startsWith('/subscription/usage') || path.startsWith('/api/subscription/usage')) {
                console.log('🎯 Routing to subscriptionUsage');
                return await (0, subscription_usage_1.subscriptionUsage)(request, response);
            }
            else if (path === '/subscription/webhook' || path === '/api/subscription/webhook' || path.startsWith('/subscription/webhook') || path.startsWith('/api/subscription/webhook')) {
                console.log('🎯 Routing to subscriptionWebhook');
                return await (0, subscription_webhook_1.subscriptionWebhook)(request, response);
            }
            else {
                console.log(`❌ No route found for: ${method} ${path}`);
                response.status(404).json({
                    error: 'Function not found',
                    path: path,
                    method: method,
                    availableRoutes: ['/api/generate-image', '/api/subscription/checkout', '/api/subscription/portal', '/api/subscription/usage', '/api/subscription/webhook']
                });
            }
        }
        catch (error) {
            console.error('Function error:', error);
            response.status(500).json({
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    });
});
//# sourceMappingURL=index.js.map