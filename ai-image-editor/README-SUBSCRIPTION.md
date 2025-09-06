# PixtorAI Subscription System Setup Guide

This document provides comprehensive instructions for setting up and configuring the PixtorAI subscription system with Stripe integration, usage limits, and feature gating.

## Table of Contents
- [Environment Variables](#environment-variables)
- [Firebase Setup](#firebase-setup)
- [Stripe Configuration](#stripe-configuration)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Feature Flags](#feature-flags)
- [Testing](#testing)
- [Rollout Plan](#rollout-plan)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Environment Variables

Add the following environment variables to your `.env.local` file:

### Firebase Configuration (existing)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Firebase Admin SDK (new)
```bash
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
```

### Stripe Configuration (new)
```bash
# Get these from your Stripe Dashboard
STRIPE_SECRET_KEY=your_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here

# For production, use live keys:
# STRIPE_SECRET_KEY=your_live_stripe_secret_key
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_live_stripe_publishable_key
```

### Gemini AI (existing)
```bash
GEMINI_API_KEY=your_gemini_api_key
```

## Firebase Setup

### 1. Enable Firestore Collections

Create the following collections in your Firestore database:

#### `subscriptions` Collection
Stores user subscription information:
```typescript
{
  id: string; // Same as userId
  userId: string;
  planId: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  cancelAtPeriodEnd: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `dailyUsage` Collection
Tracks daily usage per user:
```typescript
{
  id: string; // Format: "${userId}_${YYYY-MM-DD}"
  userId: string;
  date: string; // YYYY-MM-DD format
  usedOperations: number;
  resetAt: Timestamp; // Midnight ET
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `usageEvents` Collection
Detailed event logging:
```typescript
{
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  operationType: 'generation' | 'edit' | 'upscale' | 'background_removal' | 'object_removal' | 'inpainting';
  modelTier: 'lite' | 'secondary' | 'premium';
  modelId: string;
  success: boolean;
  errorReason?: string;
  processingTimeMs?: number;
  createdAt: Timestamp;
}
```

#### `quotaOverrides` Collection
Admin quota adjustments:
```typescript
{
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  additionalOperations: number;
  reason: string;
  adminId: string;
  createdAt: Timestamp;
}
```

### 2. Firestore Security Rules

Add these rules to your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Existing rules for users, messages, etc...
    
    // Subscriptions - users can read their own subscription
    match /subscriptions/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only server-side writes via admin SDK
    }
    
    // Daily usage - users can read their own usage
    match /dailyUsage/{usageId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow write: if false; // Only server-side writes
    }
    
    // Usage events - no direct client access
    match /usageEvents/{eventId} {
      allow read, write: if false; // Only server-side access
    }
    
    // Quota overrides - no direct client access
    match /quotaOverrides/{overrideId} {
      allow read, write: if false; // Only admin access
    }
  }
}
```

## Stripe Configuration

### 1. Create Stripe Account
1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete business verification (for live mode)
3. Get your API keys from the Dashboard

### 2. Set Up Products and Prices
Run the admin setup script to create products in Stripe:

```bash
# This will be created as part of the admin dashboard
# For now, manually create products in Stripe Dashboard:

# Product: PixtorAI Starter
# Price: $4.99/month
# ID: pixtorai_starter

# Product: PixtorAI Creator  
# Price: $9.99/month
# ID: pixtorai_creator

# Product: PixtorAI Pro
# Price: $14.99/month  
# ID: pixtorai_pro
```

### 3. Configure Webhooks
1. In Stripe Dashboard, go to "Developers" → "Webhooks"
2. Add endpoint: `https://yourdomain.com/api/subscription/webhook`
3. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 4. Configure Customer Portal
1. In Stripe Dashboard, go to "Settings" → "Billing" → "Customer portal"
2. Enable the portal and configure:
   - Allow customers to update payment methods
   - Allow customers to view invoices
   - Allow customers to cancel subscriptions
   - Set cancellation behavior (immediate or end of period)

## Database Schema

The subscription system uses Firestore collections as outlined above. Key design decisions:

### Daily Usage Reset
- Daily usage resets at midnight Eastern Time
- Uses composite document IDs: `${userId}_${YYYY-MM-DD}`
- Lazy creation - documents created on first usage

### Usage Events
- All operations are logged for analytics and debugging
- Success/failure tracking for reliability metrics
- Processing time tracking for performance monitoring

### Subscription Mirroring
- Stripe subscription data is mirrored in Firestore for fast reads
- Webhooks keep the mirror in sync
- Fallback to Stripe API if mirror is stale

## API Endpoints

### User-Facing Endpoints

#### `POST /api/subscription/checkout`
Create Stripe checkout session for plan upgrade.

**Headers:**
- `Authorization: Bearer <firebase-token>`
- `x-user-email: <user-email>` (optional)
- `x-user-name: <user-name>` (optional)

**Body:**
```json
{
  "planId": "starter|creator|pro",
  "successUrl": "https://yourdomain.com/success",
  "cancelUrl": "https://yourdomain.com/pricing"
}
```

**Response:**
```json
{
  "sessionId": "cs_xxxxx",
  "url": "https://checkout.stripe.com/pay/cs_xxxxx"
}
```

#### `POST /api/subscription/portal`
Create Stripe customer portal session.

**Headers:**
- `Authorization: Bearer <firebase-token>`

**Body:**
```json
{
  "returnUrl": "https://yourdomain.com/account"
}
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/xxxxx"
}
```

#### `GET /api/subscription/usage`
Get user's current usage and subscription info.

**Headers:**
- `Authorization: Bearer <firebase-token>`

**Response:**
```json
{
  "today": {
    "used": 5,
    "limit": 50,
    "remaining": 45
  },
  "thisMonth": {
    "used": 150,
    "projectedMonthly": 465
  },
  "plan": {
    "id": "starter",
    "name": "Starter",
    "dailyLimit": 50,
    "price": 499
  },
  "subscription": {
    "status": "active",
    "currentPeriodEnd": "2024-02-01T00:00:00Z"
  }
}
```

### Internal Endpoints

#### `POST /api/subscription/webhook`
Stripe webhook handler (called by Stripe, not clients).

#### `POST /api/generate-image-v2`
Enhanced image generation with usage tracking and limits.

## Feature Flags

The system includes feature flags for safe rollout:

```typescript
// In lib/config/subscription.ts
featureFlags: {
  subscriptionsEnabled: false, // Master toggle
  stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
  usageLimitsEnabled: true,
  newSignupDefaultPlan: 'free'
}
```

### Rollout Stages
1. **Development**: All flags off, test with fake data
2. **Internal Testing**: Enable for admin users only  
3. **Soft Launch**: Enable for 10% of new signups
4. **Full Launch**: Enable for all users

## Testing

### Unit Tests
```bash
# Test subscription service
npm run test -- --testNamePattern="SubscriptionService"

# Test Stripe integration
npm run test -- --testNamePattern="StripeService"
```

### Integration Tests

#### Test Subscription Flow
1. Create test user account
2. Navigate to pricing page
3. Click "Upgrade to Starter"
4. Complete Stripe checkout (use test card: 4242 4242 4242 4242)
5. Verify webhook updates subscription status
6. Test usage limits and tracking

#### Test Usage Limits
1. Create user with Free plan (5 operations/day)
2. Make 5 image generation requests
3. Verify 6th request is blocked with 429 error
4. Check usage indicator in sidebar shows 5/5

#### Test Feature Gating
1. Free user tries premium operation (object removal)
2. Verify 403 error with upgrade suggestion
3. Upgrade to Pro plan
4. Verify same operation now succeeds

### Test Cards (Stripe)
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires Auth: 4000 0025 0000 3155
```

## Rollout Plan

### Phase 1: Internal Testing (Week 1)
- Deploy to staging environment
- Test with internal team accounts
- Verify all webhooks and API endpoints
- Test edge cases and error scenarios

### Phase 2: Soft Launch (Week 2)
- Enable for 5% of new signups
- Monitor metrics and error rates
- Collect user feedback
- Fix any critical issues

### Phase 3: Gradual Rollout (Weeks 3-4)
- Increase to 25% of users
- Add monitoring dashboards
- Test scaling and performance
- Optimize based on usage patterns

### Phase 4: Full Launch (Week 5)
- Enable for all users
- Announce new features
- Monitor closely for first 48 hours
- Have rollback plan ready

### Rollback Plan
If critical issues are discovered:
1. Set `subscriptionsEnabled: false` in config
2. This disables all limits and billing
3. Users keep using free tier until fixed
4. No data loss, just feature disabled

## Monitoring

### Key Metrics to Track

#### Business Metrics
- Daily/Monthly Recurring Revenue (MRR)
- Subscription conversion rate
- Churn rate by plan
- Average Revenue Per User (ARPU)

#### Technical Metrics  
- API response times
- Webhook success rates
- Daily usage by plan
- Error rates by operation type

#### User Experience
- Checkout completion rate
- Time from signup to first operation
- Feature usage by plan
- Support ticket volume

### Alerts to Set Up

#### Critical Alerts
- Webhook failures > 5% in 5 minutes
- Stripe API errors > 1% in 5 minutes
- Image generation failures > 10% in 5 minutes
- No successful operations in 10 minutes

#### Warning Alerts
- Daily usage reset job fails
- Unusually high upgrade rate (potential fraud)
- Subscription cancel rate > 5% daily
- Customer portal access failures

### Dashboard Queries

#### Usage by Plan
```sql
SELECT plan_id, COUNT(*) as users, SUM(daily_operations) as total_ops
FROM daily_usage 
WHERE date = CURRENT_DATE()
GROUP BY plan_id
```

#### Conversion Funnel
```sql
SELECT 
  COUNT(DISTINCT user_id) as signups,
  COUNT(DISTINCT CASE WHEN first_operation_date IS NOT NULL THEN user_id END) as activated,
  COUNT(DISTINCT CASE WHEN subscription_start_date IS NOT NULL THEN user_id END) as converted
FROM users 
WHERE created_date >= CURRENT_DATE() - INTERVAL 7 DAY
```

## Troubleshooting

### Common Issues

#### 1. Webhook Not Receiving Events
**Symptoms:** Subscriptions not updating after Stripe checkout
**Debug Steps:**
1. Check webhook URL is correct and accessible
2. Verify webhook secret matches environment variable  
3. Check Stripe webhook logs for delivery failures
4. Test webhook endpoint manually with test event

#### 2. Usage Limits Not Working
**Symptoms:** Users can exceed daily limits
**Debug Steps:**
1. Check if `usageLimitsEnabled` feature flag is on
2. Verify user authentication in API requests
3. Check Firestore rules allow reading daily usage
4. Look for race conditions in usage counting

#### 3. Feature Gating Issues  
**Symptoms:** Users can access features they shouldn't
**Debug Steps:**
1. Verify plan configuration in `subscription.ts`
2. Check user's current plan in database
3. Ensure server-side validation is working
4. Check for client-side bypasses

#### 4. Daily Reset Not Working
**Symptoms:** Usage doesn't reset at midnight ET
**Debug Steps:**
1. Check timezone handling in reset logic
2. Verify Firestore timestamps are correct
3. Look for failed reset operations in logs
4. Test manual reset for specific users

### Log Analysis

#### Key Log Messages to Monitor
```
"Usage recorded for user X: generation using Y"
"Subscription created for user X: starter"
"Daily usage limit exceeded for user X"
"Feature gate blocked: operation Y requires Z plan"
"Webhook processed: customer.subscription.updated"
```

#### Error Patterns to Watch
```
"Webhook signature verification failed"
"Failed to record usage for user X"
"Stripe API error: rate limit exceeded"
"Firebase Admin initialization error"
```

### Performance Optimization

#### Database Optimization
- Index on `userId` for all collections
- Composite index on `(userId, date)` for usage queries
- Regular cleanup of old usage events (>90 days)

#### API Optimization
- Cache user subscription data for 5 minutes
- Batch usage recording operations
- Use Firestore transactions for critical updates

#### Client Optimization
- Load usage data only when sidebar is visible
- Cache pricing information
- Lazy load account page components

### Security Considerations

#### API Security
- All subscription endpoints require authentication
- Webhook endpoint validates Stripe signature
- No sensitive data in client-side code
- Rate limiting on all API endpoints

#### Data Privacy
- User financial data stays in Stripe
- Only mirror necessary subscription metadata
- Log aggregation without user identification
- GDPR-compliant data deletion

## Next Steps

After successful rollout, consider these enhancements:

### Short Term (1-2 months)
- Admin dashboard for user management
- Usage analytics and reporting
- A/B testing for pricing
- Customer support tools

### Medium Term (3-6 months)  
- Annual subscription discounts
- Team/business plans
- API access tiers
- White-label solutions

### Long Term (6+ months)
- Enterprise features
- Custom model training
- Reseller marketplace
- International pricing

---

For questions or issues, check the troubleshooting section or contact the development team.