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
exports.subscriptionWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
function getStripe() {
    var _a;
    const config = functions.config();
    return new stripe_1.default(((_a = config.stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || '', {
        apiVersion: '2025-08-27.basil'
    });
}
function getWebhookSecret() {
    var _a;
    const config = functions.config();
    return ((_a = config.stripe) === null || _a === void 0 ? void 0 : _a.webhook_secret) || '';
}
const subscriptionWebhook = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        // Verify webhook signature
        const stripe = getStripe();
        const endpointSecret = getWebhookSecret();
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        return res.json({ received: true });
    }
    catch (error) {
        console.error('Webhook handling error:', error);
        return res.status(500).json({ error: 'Webhook handling failed' });
    }
};
exports.subscriptionWebhook = subscriptionWebhook;
async function handleCheckoutCompleted(session) {
    var _a;
    const userId = session.client_reference_id || ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.userId);
    if (!userId) {
        console.error('No user ID found in checkout session');
        return;
    }
    const db = admin.firestore();
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    // Update user's subscription in Firestore
    await subscriptionRef.update({
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        status: 'active',
        updatedAt: admin.firestore.Timestamp.now()
    });
    console.log(`Subscription activated for user: ${userId}`);
}
async function handleSubscriptionUpdate(subscription) {
    const customerId = subscription.customer;
    const db = admin.firestore();
    // Find user by Stripe customer ID
    const userQuery = db.collection('subscriptions')
        .where('stripeCustomerId', '==', customerId);
    const userDocs = await userQuery.get();
    if (userDocs.empty) {
        console.error('No user found for customer:', customerId);
        return;
    }
    const userDoc = userDocs.docs[0];
    const subscriptionRef = userDoc.ref;
    // Update subscription status
    await subscriptionRef.update({
        status: subscription.status,
        currentPeriodStart: admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_start * 1000)),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_end * 1000)),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: admin.firestore.Timestamp.now()
    });
    console.log(`Subscription updated for customer: ${customerId}, status: ${subscription.status}`);
}
async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    const db = admin.firestore();
    // Find user by Stripe customer ID
    const userQuery = db.collection('subscriptions')
        .where('stripeCustomerId', '==', customerId);
    const userDocs = await userQuery.get();
    if (userDocs.empty) {
        console.error('No user found for customer:', customerId);
        return;
    }
    const userDoc = userDocs.docs[0];
    const subscriptionRef = userDoc.ref;
    // Downgrade to free plan
    await subscriptionRef.update({
        planId: 'free',
        status: 'canceled',
        stripeSubscriptionId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.Timestamp.now()
    });
    console.log(`Subscription canceled for customer: ${customerId}`);
}
async function handlePaymentSucceeded(invoice) {
    // Handle successful payment
    console.log(`Payment succeeded for customer: ${invoice.customer}`);
}
async function handlePaymentFailed(invoice) {
    // Handle failed payment
    console.log(`Payment failed for customer: ${invoice.customer}`);
    const customerId = invoice.customer;
    const db = admin.firestore();
    // Find user by Stripe customer ID and update status
    const userQuery = db.collection('subscriptions')
        .where('stripeCustomerId', '==', customerId);
    const userDocs = await userQuery.get();
    if (!userDocs.empty) {
        const userDoc = userDocs.docs[0];
        const subscriptionRef = userDoc.ref;
        await subscriptionRef.update({
            status: 'past_due',
            updatedAt: admin.firestore.Timestamp.now()
        });
    }
}
//# sourceMappingURL=subscription-webhook.js.map