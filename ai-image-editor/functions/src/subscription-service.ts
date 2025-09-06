// Simplified Subscription Service for Firebase Functions
import * as admin from 'firebase-admin';
import { Plan, UserSubscription, DailyUsage, DEFAULT_PLANS } from './subscription-types';

export class SubscriptionService {
  private static instance: SubscriptionService;
  private db: admin.firestore.Firestore;
  
  private constructor() {
    this.db = admin.firestore();
  }
  
  public static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  // Get plan by ID
  getPlanById(planId: string): Plan | null {
    return DEFAULT_PLANS.find(plan => plan.id === planId) || null;
  }

  // Get user's current subscription
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const subscriptionRef = this.db.collection('subscriptions').doc(userId);
      const subscriptionDoc = await subscriptionRef.get();
      
      if (!subscriptionDoc.exists) {
        // Create default free subscription for new users
        const newSubscription: UserSubscription = {
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
        
        await subscriptionRef.set({
          ...newSubscription,
          currentPeriodStart: admin.firestore.Timestamp.fromDate(newSubscription.currentPeriodStart),
          currentPeriodEnd: admin.firestore.Timestamp.fromDate(newSubscription.currentPeriodEnd),
          createdAt: admin.firestore.Timestamp.fromDate(newSubscription.createdAt),
          updatedAt: admin.firestore.Timestamp.fromDate(newSubscription.updatedAt)
        });
        
        return newSubscription;
      }
      
      const data = subscriptionDoc.data()!;
      return {
        ...data,
        currentPeriodStart: data.currentPeriodStart?.toDate() || new Date(),
        currentPeriodEnd: data.currentPeriodEnd?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as UserSubscription;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  }

  // Get user's current plan
  async getUserPlan(userId: string): Promise<Plan> {
    const subscription = await this.getUserSubscription(userId);
    const planId = subscription?.planId || 'free';
    return this.getPlanById(planId) || DEFAULT_PLANS[0];
  }

  // Get today's usage for a user
  async getTodayUsage(userId: string): Promise<DailyUsage> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usageId = `${userId}_${today}`;
    
    try {
      const usageRef = this.db.collection('dailyUsage').doc(usageId);
      const usageDoc = await usageRef.get();
      
      if (!usageDoc.exists) {
        // Create new usage record for today
        const newUsage: DailyUsage = {
          id: usageId,
          userId,
          date: today,
          usedOperations: 0,
          resetAt: this.getNextMidnightET(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await usageRef.set({
          ...newUsage,
          resetAt: admin.firestore.Timestamp.fromDate(newUsage.resetAt),
          createdAt: admin.firestore.Timestamp.fromDate(newUsage.createdAt),
          updatedAt: admin.firestore.Timestamp.fromDate(newUsage.updatedAt)
        });
        
        return newUsage;
      }
      
      const data = usageDoc.data()!;
      return {
        ...data,
        resetAt: data.resetAt?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as DailyUsage;
    } catch (error) {
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
  async getUsageStats(userId: string, days: number): Promise<{ date: string; operations: number }[]> {
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
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return [];
    }
  }

  // Record usage for a user
  async recordUsage(userId: string, operationType: string = 'generation'): Promise<boolean> {
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
        } else {
          // Increment existing usage
          const currentUsage = usageDoc.data()!.usedOperations || 0;
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
    } catch (error) {
      console.error('Error recording usage:', error);
      return false;
    }
  }

  // Check if user can perform an operation
  async checkUsageLimit(userId: string): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
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
    } catch (error) {
      console.error('Error checking usage limit:', error);
      // Allow operation on error to prevent blocking users
      return { allowed: true };
    }
  }

  private getNextMidnightET(): Date {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const nextMidnight = new Date(et);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    return nextMidnight;
  }
}