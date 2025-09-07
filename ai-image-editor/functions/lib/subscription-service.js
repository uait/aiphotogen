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
exports.SubscriptionService = void 0;
// Simplified Subscription Service for Firebase Functions
const admin = __importStar(require("firebase-admin"));
const subscription_types_1 = require("./subscription-types");
class SubscriptionService {
    constructor() {
        this.db = admin.firestore();
    }
    static getInstance() {
        if (!SubscriptionService.instance) {
            SubscriptionService.instance = new SubscriptionService();
        }
        return SubscriptionService.instance;
    }
    // Get plan by ID
    getPlanById(planId) {
        return subscription_types_1.DEFAULT_PLANS.find(plan => plan.id === planId) || null;
    }
    // Get user's current subscription
    async getUserSubscription(userId) {
        var _a, _b, _c, _d;
        try {
            const subscriptionRef = this.db.collection('subscriptions').doc(userId);
            const subscriptionDoc = await subscriptionRef.get();
            if (!subscriptionDoc.exists) {
                // Create default free subscription for new users
                const newSubscription = {
                    id: userId,
                    userId,
                    planId: 'free',
                    status: 'free',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                    cancelAtPeriodEnd: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                await subscriptionRef.set(Object.assign(Object.assign({}, newSubscription), { currentPeriodStart: admin.firestore.Timestamp.fromDate(newSubscription.currentPeriodStart), currentPeriodEnd: admin.firestore.Timestamp.fromDate(newSubscription.currentPeriodEnd), createdAt: admin.firestore.Timestamp.fromDate(newSubscription.createdAt), updatedAt: admin.firestore.Timestamp.fromDate(newSubscription.updatedAt) }));
                return newSubscription;
            }
            const data = subscriptionDoc.data();
            return Object.assign(Object.assign({}, data), { currentPeriodStart: ((_a = data.currentPeriodStart) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(), currentPeriodEnd: ((_b = data.currentPeriodEnd) === null || _b === void 0 ? void 0 : _b.toDate()) || new Date(), createdAt: ((_c = data.createdAt) === null || _c === void 0 ? void 0 : _c.toDate()) || new Date(), updatedAt: ((_d = data.updatedAt) === null || _d === void 0 ? void 0 : _d.toDate()) || new Date() });
        }
        catch (error) {
            console.error('Error getting user subscription:', error);
            return null;
        }
    }
    // Get user's current plan
    async getUserPlan(userId) {
        const subscription = await this.getUserSubscription(userId);
        const planId = (subscription === null || subscription === void 0 ? void 0 : subscription.planId) || 'free';
        return this.getPlanById(planId) || subscription_types_1.DEFAULT_PLANS[0];
    }
    // Get today's usage for a user
    async getTodayUsage(userId) {
        var _a, _b, _c;
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const usageId = `${userId}_${today}`;
        try {
            const usageRef = this.db.collection('dailyUsage').doc(usageId);
            const usageDoc = await usageRef.get();
            if (!usageDoc.exists) {
                // Create new usage record for today
                const newUsage = {
                    id: usageId,
                    userId,
                    date: today,
                    usedOperations: 0,
                    resetAt: this.getNextMidnightET(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                await usageRef.set(Object.assign(Object.assign({}, newUsage), { resetAt: admin.firestore.Timestamp.fromDate(newUsage.resetAt), createdAt: admin.firestore.Timestamp.fromDate(newUsage.createdAt), updatedAt: admin.firestore.Timestamp.fromDate(newUsage.updatedAt) }));
                return newUsage;
            }
            const data = usageDoc.data();
            return Object.assign(Object.assign({}, data), { resetAt: ((_a = data.resetAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(), createdAt: ((_b = data.createdAt) === null || _b === void 0 ? void 0 : _b.toDate()) || new Date(), updatedAt: ((_c = data.updatedAt) === null || _c === void 0 ? void 0 : _c.toDate()) || new Date() });
        }
        catch (error) {
            console.error('Error getting today usage:', error);
            // Return default usage
            return {
                id: usageId,
                userId,
                date: today,
                usedOperations: 0,
                resetAt: this.getNextMidnightET(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }
    }
    // Get usage stats for the last N days
    async getUsageStats(userId, days) {
        try {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
            const usageQuery = this.db.collection('dailyUsage')
                .where('userId', '==', userId)
                .where('date', '>=', startDate.toISOString().split('T')[0])
                .orderBy('date', 'desc');
            const usageSnapshot = await usageQuery.get();
            return usageSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    date: data.date,
                    operations: data.usedOperations || 0
                };
            });
        }
        catch (error) {
            console.error('Error getting usage stats:', error);
            return [];
        }
    }
    // Record usage for a user
    async recordUsage(userId, operationType = 'generation') {
        const today = new Date().toISOString().split('T')[0];
        const usageId = `${userId}_${today}`;
        try {
            const usageRef = this.db.collection('dailyUsage').doc(usageId);
            await this.db.runTransaction(async (transaction) => {
                const usageDoc = await transaction.get(usageRef);
                if (!usageDoc.exists) {
                    // Create new usage record
                    const newUsage = {
                        id: usageId,
                        userId,
                        date: today,
                        usedOperations: 1,
                        resetAt: admin.firestore.Timestamp.fromDate(this.getNextMidnightET()),
                        createdAt: admin.firestore.Timestamp.now(),
                        updatedAt: admin.firestore.Timestamp.now()
                    };
                    transaction.set(usageRef, newUsage);
                }
                else {
                    // Increment existing usage
                    const currentUsage = usageDoc.data().usedOperations || 0;
                    transaction.update(usageRef, {
                        usedOperations: currentUsage + 1,
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                }
            });
            // Log the usage event
            const eventRef = this.db.collection('usageEvents').doc();
            await eventRef.set({
                userId,
                date: today,
                operationType,
                modelTier: 'premium',
                modelId: 'gemini-2.5-flash-image-preview',
                success: true,
                createdAt: admin.firestore.Timestamp.now()
            });
            return true;
        }
        catch (error) {
            console.error('Error recording usage:', error);
            return false;
        }
    }
    // Check if user can perform an operation
    async checkUsageLimit(userId) {
        try {
            const [plan, todayUsage] = await Promise.all([
                this.getUserPlan(userId),
                this.getTodayUsage(userId)
            ]);
            const remaining = Math.max(0, plan.dailyLimit - todayUsage.usedOperations);
            if (todayUsage.usedOperations >= plan.dailyLimit) {
                return {
                    allowed: false,
                    reason: `Daily limit of ${plan.dailyLimit} operations reached. Upgrade your plan for higher limits.`,
                    remaining: 0
                };
            }
            return {
                allowed: true,
                remaining
            };
        }
        catch (error) {
            console.error('Error checking usage limit:', error);
            // Allow operation on error to prevent blocking users
            return { allowed: true };
        }
    }
    getNextMidnightET() {
        const now = new Date();
        const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const nextMidnight = new Date(et);
        nextMidnight.setDate(nextMidnight.getDate() + 1);
        nextMidnight.setHours(0, 0, 0, 0);
        return nextMidnight;
    }
}
exports.SubscriptionService = SubscriptionService;
//# sourceMappingURL=subscription-service.js.map