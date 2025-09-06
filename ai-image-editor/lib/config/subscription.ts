// PixtorAI Subscription Configuration
import { 
  Plan, 
  ModelConfig, 
  ModelTier, 
  SubscriptionConfig, 
  PlanFeature,
  OperationType 
} from '../types/subscription';

// Plan Features Configuration
export const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  free: [
    { id: 'basic_generation', name: 'Basic AI Generation', description: 'Text-to-image generation', enabled: true },
    { id: 'basic_editing', name: 'Basic Image Editing', description: 'Simple image modifications', enabled: true }
  ],
  starter: [
    { id: 'basic_generation', name: 'Basic AI Generation', description: 'Text-to-image generation', enabled: true },
    { id: 'basic_editing', name: 'Basic Image Editing', description: 'Simple image modifications', enabled: true },
    { id: 'background_removal', name: 'Background Removal', description: 'Remove backgrounds (limited)', enabled: true, limit: 10 }
  ],
  creator: [
    { id: 'basic_generation', name: 'Basic AI Generation', description: 'Text-to-image generation', enabled: true },
    { id: 'advanced_editing', name: 'Advanced Editing', description: 'Retouch and upscaling tools', enabled: true },
    { id: 'background_removal', name: 'Background Removal', description: 'Unlimited background removal', enabled: true },
    { id: 'priority_processing', name: 'Priority Processing', description: 'Faster image generation', enabled: true }
  ],
  pro: [
    { id: 'basic_generation', name: 'Basic AI Generation', description: 'Text-to-image generation', enabled: true },
    { id: 'advanced_editing', name: 'Advanced Editing', description: 'Full editing suite', enabled: true },
    { id: 'hd_generation', name: 'HD Generation', description: 'High-resolution outputs', enabled: true },
    { id: 'batch_processing', name: 'Batch Processing', description: 'Process multiple images', enabled: true },
    { id: 'object_removal', name: 'Object Removal', description: 'Remove unwanted objects', enabled: true },
    { id: 'inpainting', name: 'AI Inpainting', description: 'Intelligent image completion', enabled: true },
    { id: 'priority_processing', name: 'Highest Priority', description: 'Fastest processing queue', enabled: true },
    { id: 'early_access', name: 'Early Access', description: 'New features first', enabled: true }
  ]
};

// Model Tier Configuration
export const MODEL_CONFIGS: ModelConfig[] = [
  // Lite Tier - Entry level models
  {
    tier: ModelTier.LITE,
    modelId: 'gemini-2.5-flash-image-preview',
    displayName: 'PixtorAI Lite',
    description: 'Fast, efficient image generation for basic needs',
    isActive: true,
    costMultiplier: 1.0
  },
  
  // Secondary Tier - Mid-quality models
  {
    tier: ModelTier.SECONDARY,
    modelId: 'gemini-2.0-flash-exp',
    displayName: 'PixtorAI Standard',
    description: 'Higher quality generation with better detail',
    isActive: true,
    costMultiplier: 1.5
  },
  
  // Premium Tier - Top quality models
  {
    tier: ModelTier.PREMIUM,
    modelId: 'gemini-pro-vision-hd',
    displayName: 'PixtorAI Pro',
    description: 'Highest quality, HD output with advanced features',
    isActive: true,
    costMultiplier: 3.0
  }
];

// Plan Definitions
export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    price: 0,
    currency: 'usd',
    interval: 'month',
    dailyLimit: 5,
    allowedTiers: [ModelTier.LITE],
    features: PLAN_FEATURES.free,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'starter',
    name: 'starter', 
    displayName: 'Starter',
    price: 499, // $4.99
    currency: 'usd',
    interval: 'month',
    dailyLimit: 50,
    allowedTiers: [ModelTier.LITE],
    features: PLAN_FEATURES.starter,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'creator',
    name: 'creator',
    displayName: 'Creator', 
    price: 999, // $9.99
    currency: 'usd',
    interval: 'month',
    dailyLimit: 150,
    allowedTiers: [ModelTier.LITE, ModelTier.SECONDARY],
    features: PLAN_FEATURES.creator,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'pro',
    name: 'pro',
    displayName: 'Pro',
    price: 1499, // $14.99
    currency: 'usd', 
    interval: 'month',
    dailyLimit: 300,
    allowedTiers: [ModelTier.LITE, ModelTier.SECONDARY, ModelTier.PREMIUM],
    features: PLAN_FEATURES.pro,
    isActive: true,
    sortOrder: 4
  }
];

// Operation to Model Tier mapping
export const OPERATION_MODEL_REQUIREMENTS: Record<OperationType, ModelTier> = {
  [OperationType.GENERATION]: ModelTier.LITE,
  [OperationType.EDIT]: ModelTier.LITE,
  [OperationType.UPSCALE]: ModelTier.SECONDARY,
  [OperationType.BACKGROUND_REMOVAL]: ModelTier.LITE,
  [OperationType.OBJECT_REMOVAL]: ModelTier.PREMIUM,
  [OperationType.INPAINTING]: ModelTier.PREMIUM
};

// Main Configuration
export const SUBSCRIPTION_CONFIG: SubscriptionConfig = {
  plans: PLANS,
  modelConfigs: MODEL_CONFIGS,
  timezone: 'America/New_York',
  featureFlags: {
    subscriptionsEnabled: process.env.NODE_ENV === 'development' ? false : true, // Feature flag for rollout
    stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
    usageLimitsEnabled: true,
    newSignupDefaultPlan: 'free'
  }
};

// Helper functions
export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find(plan => plan.id === planId);
}

export function getModelConfigByTier(tier: ModelTier): ModelConfig | undefined {
  return MODEL_CONFIGS.find(config => config.tier === tier && config.isActive);
}

export function getModelConfigById(modelId: string): ModelConfig | undefined {
  return MODEL_CONFIGS.find(config => config.modelId === modelId);
}

export function isOperationAllowedForPlan(operation: OperationType, planId: string): boolean {
  const plan = getPlanById(planId);
  if (!plan) return false;

  const requiredTier = OPERATION_MODEL_REQUIREMENTS[operation];
  return plan.allowedTiers.includes(requiredTier);
}

export function getHighestAllowedTierForPlan(planId: string): ModelTier | null {
  const plan = getPlanById(planId);
  if (!plan || plan.allowedTiers.length === 0) return null;

  // Return highest tier (premium > secondary > lite)
  if (plan.allowedTiers.includes(ModelTier.PREMIUM)) return ModelTier.PREMIUM;
  if (plan.allowedTiers.includes(ModelTier.SECONDARY)) return ModelTier.SECONDARY;
  return ModelTier.LITE;
}

export function formatPrice(priceInCents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: priceInCents % 100 === 0 ? 0 : 2
  }).format(priceInCents / 100);
}