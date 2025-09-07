"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionUsage = void 0;
const firebase_admin_1 = require("./firebase-admin");
const subscription_service_1 = require("./subscription-service");
const subscriptionUsage = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        // Verify authentication
        const authHeader = req.headers.authorization;
        const userId = await (0, firebase_admin_1.verifyAuthToken)(authHeader || null);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const subscriptionService = subscription_service_1.SubscriptionService.getInstance();
        // Get current plan and subscription
        const [plan, subscription, todayUsage] = await Promise.all([
            subscriptionService.getUserPlan(userId),
            subscriptionService.getUserSubscription(userId),
            subscriptionService.getTodayUsage(userId)
        ]);
        // Get monthly usage stats
        const last30DaysUsage = await subscriptionService.getUsageStats(userId, 30);
        const monthlyUsageTotal = last30DaysUsage.reduce((sum, day) => sum + day.operations, 0);
        // Calculate projected monthly usage
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const dayOfMonth = new Date().getDate();
        const projectedMonthly = Math.round((monthlyUsageTotal / dayOfMonth) * daysInMonth);
        const response = {
            today: {
                used: todayUsage.usedOperations,
                limit: plan.dailyLimit,
                remaining: Math.max(0, plan.dailyLimit - todayUsage.usedOperations)
            },
            thisMonth: {
                used: monthlyUsageTotal,
                projectedMonthly
            },
            plan,
            subscription: subscription
        };
        return res.json(response);
    }
    catch (error) {
        console.error('Usage retrieval error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to retrieve usage information'
        });
    }
};
exports.subscriptionUsage = subscriptionUsage;
//# sourceMappingURL=subscription-usage.js.map