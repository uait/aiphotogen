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
exports.subscriptionCheckout = void 0;
const functions = __importStar(require("firebase-functions"));
const firebase_admin_1 = require("./firebase-admin");
const stripe_1 = __importDefault(require("stripe"));
function getStripe() {
    var _a;
    const config = functions.config();
    return new stripe_1.default(((_a = config.stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || '', {
        apiVersion: '2025-08-27.basil'
    });
}
const subscriptionCheckout = async (req, res) => {
    var _a, _b, _c;
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
        const { planId, successUrl, cancelUrl } = req.body;
        if (!planId || !successUrl || !cancelUrl) {
            return res.status(400).json({
                error: 'Missing required fields: planId, successUrl, cancelUrl'
            });
        }
        // Map plan IDs to Stripe price IDs (you'll need to set these up in Stripe)
        const config = functions.config();
        const planPriceMapping = {
            'starter': ((_a = config.stripe) === null || _a === void 0 ? void 0 : _a.starter_price_id) || 'price_1234starter',
            'creator': ((_b = config.stripe) === null || _b === void 0 ? void 0 : _b.creator_price_id) || 'price_1234creator',
            'pro': ((_c = config.stripe) === null || _c === void 0 ? void 0 : _c.pro_price_id) || 'price_1234pro'
        };
        const priceId = planPriceMapping[planId];
        if (!priceId) {
            return res.status(400).json({ error: 'Invalid plan ID' });
        }
        // Create Stripe Checkout Session
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: userId,
            metadata: {
                userId: userId,
                planId: planId
            }
        });
        return res.json({
            sessionId: session.id,
            url: session.url
        });
    }
    catch (error) {
        console.error('Checkout error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to create checkout session'
        });
    }
};
exports.subscriptionCheckout = subscriptionCheckout;
//# sourceMappingURL=subscription-checkout.js.map