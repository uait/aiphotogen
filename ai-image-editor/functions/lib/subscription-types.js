"use strict";
// Simplified subscription types for Firebase Functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PLANS = void 0;
// Default plans
exports.DEFAULT_PLANS = [
    {
        id: 'free',
        name: 'free',
        displayName: 'Free',
        price: 0,
        currency: 'usd',
        interval: 'month',
        dailyLimit: 5,
        features: ['Basic image generation', '5 images per day'],
        isActive: true
    },
    {
        id: 'starter',
        name: 'starter',
        displayName: 'Starter',
        price: 499,
        currency: 'usd',
        interval: 'month',
        dailyLimit: 50,
        features: ['High-quality image generation', '50 images per day', 'Priority processing'],
        isActive: true
    },
    {
        id: 'creator',
        name: 'creator',
        displayName: 'Creator',
        price: 999,
        currency: 'usd',
        interval: 'month',
        dailyLimit: 150,
        features: ['Premium models', '150 images per day', 'Advanced editing', 'Priority support'],
        isActive: true
    },
    {
        id: 'pro',
        name: 'pro',
        displayName: 'Pro',
        price: 1499,
        currency: 'usd',
        interval: 'month',
        dailyLimit: 300,
        features: ['All premium features', '300 images per day', 'Commercial license', '24/7 support'],
        isActive: true
    }
];
//# sourceMappingURL=subscription-types.js.map