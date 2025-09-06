// Subscription System Types for PixtorAI

export interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  dailyLimit: number;
  allowedTiers: ModelTier[];
  features: PlanFeature[];
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  limit?: number; // Optional numeric limit for the feature
}

export enum ModelTier {
  LITE = 'lite',
  SECONDARY = 'secondary', 
  PREMIUM = 'premium'
}

export interface ModelConfig {
  tier: ModelTier;
  modelId: string;
  displayName: string;
  description: string;
  isActive: boolean;
  costMultiplier: number; // How much this model costs relative to base
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired'
}

export interface UsageRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  operationType: OperationType;
  modelTier: ModelTier;
  modelId: string;
  success: boolean;
  errorReason?: string;
  processingTimeMs?: number;
  createdAt: Date;
}

export enum OperationType {
  GENERATION = 'generation',
  EDIT = 'edit',
  UPSCALE = 'upscale',
  BACKGROUND_REMOVAL = 'background_removal',
  OBJECT_REMOVAL = 'object_removal',
  INPAINTING = 'inpainting'
}

export interface DailyUsage {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  usedOperations: number;
  resetAt: Date; // Midnight ET
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  plan: Plan;
}

export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;
  suggestedPlan?: Plan;
  requiredTier?: ModelTier;
}

// Configuration types
export interface SubscriptionConfig {
  plans: Plan[];
  modelConfigs: ModelConfig[];
  timezone: string; // America/New_York
  featureFlags: {
    subscriptionsEnabled: boolean;
    stripeEnabled: boolean;
    usageLimitsEnabled: boolean;
    newSignupDefaultPlan: string;
  };
}

// Stripe webhook types
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  created: number;
  livemode: boolean;
}

// Admin types
export interface AdminUserSubscriptionView {
  userId: string;
  email?: string;
  phoneNumber?: string;
  currentPlan: Plan;
  subscription: UserSubscription;
  todayUsage: number;
  last7DaysUsage: number;
  last30DaysUsage: number;
  quotaOverrides: QuotaOverride[];
}

export interface QuotaOverride {
  id: string;
  userId: string;
  date: string;
  additionalOperations: number;
  reason: string;
  adminId: string;
  createdAt: Date;
}

// API Response types
export interface CreateCheckoutSessionRequest {
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface GetUsageResponse {
  today: {
    used: number;
    limit: number;
    remaining: number;
  };
  thisMonth: {
    used: number;
    projectedMonthly: number;
  };
  plan: Plan;
  subscription: UserSubscription;
}