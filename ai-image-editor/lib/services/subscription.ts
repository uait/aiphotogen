// PixtorAI Subscription Service
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Plan, 
  UserSubscription, 
  DailyUsage, 
  UsageRecord, 
  UsageLimitResult, 
  FeatureGateResult,
  SubscriptionStatus,
  OperationType,
  ModelTier,
  QuotaOverride
} from '../types/subscription';
import { 
  SUBSCRIPTION_CONFIG, 
  getPlanById, 
  getHighestAllowedTierForPlan,
  OPERATION_MODEL_REQUIREMENTS,
  isOperationAllowedForPlan 
} from '../config/subscription';

export class SubscriptionService {
  private static instance: SubscriptionService;
  
  public static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  // Get user's current subscription
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const subscriptionRef = doc(db, 'subscriptions', userId);
      const subscriptionDoc = await getDoc(subscriptionRef);
      
      if (!subscriptionDoc.exists()) {
        // Create default free subscription for new users
        const freePlan = getPlanById('free');
        if (!freePlan) throw new Error('Free plan not configured');
        
        const newSubscription: UserSubscription = {
          id: userId,
          userId,
          planId: 'free',
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          cancelAtPeriodEnd: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(subscriptionRef, {
          ...newSubscription,
          currentPeriodStart: Timestamp.fromDate(newSubscription.currentPeriodStart),
          currentPeriodEnd: Timestamp.fromDate(newSubscription.currentPeriodEnd),
          createdAt: Timestamp.fromDate(newSubscription.createdAt),
          updatedAt: Timestamp.fromDate(newSubscription.updatedAt)
        });
        
        return newSubscription;
      }
      
      const data = subscriptionDoc.data();
      return {
        ...data,
        currentPeriodStart: data.currentPeriodStart.toDate(),
        currentPeriodEnd: data.currentPeriodEnd.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      } as UserSubscription;
      
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  // Get user's current plan
  async getUserPlan(userId: string): Promise<Plan> {
    const subscription = await this.getUserSubscription(userId);
    const plan = getPlanById(subscription?.planId || 'free');
    
    if (!plan) {
      throw new Error(`Plan not found: ${subscription?.planId}`);
    }
    
    return plan;
  }

  // Update user subscription
  async updateUserSubscription(userId: string, updates: Partial<UserSubscription>): Promise<void> {
    try {
      const subscriptionRef = doc(db, 'subscriptions', userId);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

      // Convert dates to Timestamps
      if (updates.currentPeriodStart) {
        updateData.currentPeriodStart = Timestamp.fromDate(updates.currentPeriodStart);
      }
      if (updates.currentPeriodEnd) {
        updateData.currentPeriodEnd = Timestamp.fromDate(updates.currentPeriodEnd);
      }

      await updateDoc(subscriptionRef, updateData);
    } catch (error) {
      console.error('Error updating user subscription:', error);
      throw error;
    }
  }

  // Get today's usage for a user
  async getTodayUsage(userId: string): Promise<DailyUsage> {
    const today = this.getTodayDateString();
    
    try {
      const usageRef = doc(db, 'dailyUsage', `${userId}_${today}`);
      const usageDoc = await getDoc(usageRef);
      
      if (!usageDoc.exists()) {
        const resetAt = this.getNextResetTime();
        const newUsage: DailyUsage = {
          id: `${userId}_${today}`,
          userId,
          date: today,
          usedOperations: 0,
          resetAt,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(usageRef, {
          ...newUsage,
          resetAt: Timestamp.fromDate(resetAt),
          createdAt: Timestamp.fromDate(newUsage.createdAt),
          updatedAt: Timestamp.fromDate(newUsage.updatedAt)
        });
        
        return newUsage;
      }
      
      const data = usageDoc.data();
      return {
        ...data,
        resetAt: data.resetAt.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      } as DailyUsage;
      
    } catch (error) {
      console.error('Error getting today usage:', error);
      throw error;
    }
  }

  // Check if user can perform an operation
  async checkUsageLimit(userId: string, operationType: OperationType): Promise<UsageLimitResult> {
    const [plan, todayUsage, quotaOverrides] = await Promise.all([
      this.getUserPlan(userId),
      this.getTodayUsage(userId),
      this.getQuotaOverrides(userId, this.getTodayDateString())
    ]);
    
    // Calculate additional quota from overrides
    const additionalQuota = quotaOverrides.reduce((sum, override) => sum + override.additionalOperations, 0);
    const totalLimit = plan.dailyLimit + additionalQuota;
    const remaining = Math.max(0, totalLimit - todayUsage.usedOperations);
    
    return {
      allowed: remaining > 0,
      remaining,
      limit: totalLimit,
      resetAt: todayUsage.resetAt,
      plan
    };
  }

  // Check if user can access a feature/model tier
  async checkFeatureGate(userId: string, operationType: OperationType, requestedTier?: ModelTier): Promise<FeatureGateResult> {
    const plan = await this.getUserPlan(userId);
    
    // Check if operation is allowed for this plan
    if (!isOperationAllowedForPlan(operationType, plan.id)) {
      const suggestedPlan = this.getSuggestedPlanForOperation(operationType);
      return {
        allowed: false,
        reason: `${operationType} requires ${suggestedPlan?.displayName || 'higher'} plan`,
        suggestedPlan,
        requiredTier: OPERATION_MODEL_REQUIREMENTS[operationType]
      };
    }
    
    // Check model tier access
    if (requestedTier && !plan.allowedTiers.includes(requestedTier)) {
      const highestAllowed = getHighestAllowedTierForPlan(plan.id);
      return {
        allowed: false,
        reason: `${requestedTier} tier requires higher plan. Using ${highestAllowed} instead.`,
        suggestedPlan: this.getSuggestedPlanForTier(requestedTier),
        requiredTier: requestedTier
      };
    }
    
    return { allowed: true };
  }

  // Record a usage event
  async recordUsage(
    userId: string, 
    operationType: OperationType, 
    modelTier: ModelTier, 
    modelId: string,
    success: boolean,
    errorReason?: string,
    processingTimeMs?: number
  ): Promise<void> {
    const batch = writeBatch(db);
    
    try {
      // Record usage event
      const usageEventRef = doc(collection(db, 'usageEvents'));
      const usageEvent: UsageRecord = {
        id: usageEventRef.id,
        userId,
        date: this.getTodayDateString(),
        operationType,
        modelTier,
        modelId,
        success,
        errorReason,
        processingTimeMs,
        createdAt: new Date()
      };
      
      batch.set(usageEventRef, {
        ...usageEvent,
        createdAt: Timestamp.fromDate(usageEvent.createdAt)
      });
      
      // Update daily usage counter (only for successful operations)
      if (success) {
        const today = this.getTodayDateString();
        const usageRef = doc(db, 'dailyUsage', `${userId}_${today}`);
        
        // Get current usage or create new
        const currentUsage = await this.getTodayUsage(userId);
        
        batch.update(usageRef, {
          usedOperations: currentUsage.usedOperations + 1,
          updatedAt: Timestamp.fromDate(new Date())
        });
      }
      
      await batch.commit();
      
      // Log for observability
      console.log('Usage recorded:', {
        userId,
        operationType,
        modelTier,
        modelId,
        success,
        processingTimeMs
      });
      
    } catch (error) {
      console.error('Error recording usage:', error);
      throw error;
    }
  }

  // Get quota overrides for a user on a specific date
  async getQuotaOverrides(userId: string, date: string): Promise<QuotaOverride[]> {
    try {
      const overridesQuery = query(
        collection(db, 'quotaOverrides'),
        where('userId', '==', userId),
        where('date', '==', date)
      );
      
      const snapshot = await getDocs(overridesQuery);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as QuotaOverride[];
      
    } catch (error) {
      console.error('Error getting quota overrides:', error);
      return [];
    }
  }

  // Admin: Add quota override
  async addQuotaOverride(
    userId: string, 
    date: string, 
    additionalOperations: number, 
    reason: string, 
    adminId: string
  ): Promise<void> {
    try {
      const overrideRef = doc(collection(db, 'quotaOverrides'));
      const override: QuotaOverride = {
        id: overrideRef.id,
        userId,
        date,
        additionalOperations,
        reason,
        adminId,
        createdAt: new Date()
      };
      
      await setDoc(overrideRef, {
        ...override,
        createdAt: Timestamp.fromDate(override.createdAt)
      });
      
    } catch (error) {
      console.error('Error adding quota override:', error);
      throw error;
    }
  }

  // Get usage stats for admin
  async getUsageStats(userId: string, days: number): Promise<{ date: string; operations: number }[]> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const usageQuery = query(
        collection(db, 'usageEvents'),
        where('userId', '==', userId),
        where('success', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(usageQuery);
      const usageByDate: Record<string, number> = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.date;
        usageByDate[date] = (usageByDate[date] || 0) + 1;
      });
      
      // Fill in missing dates with 0
      const result = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(endDate.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateString = date.toISOString().split('T')[0];
        result.push({
          date: dateString,
          operations: usageByDate[dateString] || 0
        });
      }
      
      return result.reverse();
      
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw error;
    }
  }

  // Helper: Get today's date string in YYYY-MM-DD format
  private getTodayDateString(): string {
    const now = new Date();
    // Convert to Eastern Time for reset calculation
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return easternTime.toISOString().split('T')[0];
  }

  // Helper: Get next reset time (midnight ET)
  private getNextResetTime(): Date {
    const now = new Date();
    const easternNow = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    // Get midnight ET tomorrow
    const midnight = new Date(easternNow);
    midnight.setHours(24, 0, 0, 0);
    
    return midnight;
  }

  // Helper: Get suggested plan for operation
  private getSuggestedPlanForOperation(operationType: OperationType): Plan | undefined {
    const requiredTier = OPERATION_MODEL_REQUIREMENTS[operationType];
    return SUBSCRIPTION_CONFIG.plans.find(plan => 
      plan.allowedTiers.includes(requiredTier) && plan.id !== 'free'
    );
  }

  // Helper: Get suggested plan for model tier
  private getSuggestedPlanForTier(tier: ModelTier): Plan | undefined {
    return SUBSCRIPTION_CONFIG.plans.find(plan => 
      plan.allowedTiers.includes(tier) && plan.id !== 'free'
    );
  }

  // Reset daily usage (called by cron job)
  async resetDailyUsage(): Promise<void> {
    try {
      console.log('Starting daily usage reset...');
      const yesterday = this.getTodayDateString();
      
      // This would typically be called by a cron job to reset all users
      // For now, we rely on lazy creation of new daily usage records
      
      console.log('Daily usage reset completed');
    } catch (error) {
      console.error('Error resetting daily usage:', error);
      throw error;
    }
  }
}