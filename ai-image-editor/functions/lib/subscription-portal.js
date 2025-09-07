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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionPortal = void 0;
const functions = __importStar(require("firebase-functions"));
const firebase_admin_1 = require("./firebase-admin");
const subscription_service_1 = require("./subscription-service");
const stripe_1 = __importDefault(require("stripe"));
function getStripe() {
    var _a;
    const config = functions.config();
    return new stripe_1.default(((_a = config.stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || '', {
        apiVersion: '2025-08-27.basil'
    });
}
const subscriptionPortal = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        // Verify authentication
        const authHeader = req.headers.authorization;
        const userId = await (0, firebase_admin_1.verifyAuthToken)(authHeader || null);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { returnUrl } = req.body;
        if (!returnUrl) {
            return res.status(400).json({
                error: 'Missing required field: returnUrl'
            });
        }
        // Get user's subscription to find Stripe customer ID
        const subscriptionService = subscription_service_1.SubscriptionService.getInstance();
        const subscription = await subscriptionService.getUserSubscription(userId);
        if (!(subscription === null || subscription === void 0 ? void 0 : subscription.stripeCustomerId)) {
            return res.status(400).json({
                error: 'No subscription found. Please subscribe first.'
            });
        }
        // Create Stripe billing portal session
        const stripe = getStripe();
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: returnUrl,
        });
        return res.json({
            url: session.url
        });
    }
    catch (error) {
        console.error('Portal error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to create billing portal session'
        });
    }
};
exports.subscriptionPortal = subscriptionPortal;
//# sourceMappingURL=subscription-portal.js.map