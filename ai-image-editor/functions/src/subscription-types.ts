// Simplified subscription types for Firebase Functions

export interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  dailyLimit: number;
  features: string[];
  isActive: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'free';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyUsage {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  usedOperations: number;
  resetAt: Date;
  createdAt: Date;
  updatedAt: Date;
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

// Default plans
export const DEFAULT_PLANS: Plan[] = [
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