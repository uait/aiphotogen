# Stripe Subscription Setup Guide for PixtorAI

## 📋 Prerequisites
- Stripe account (sign up at https://stripe.com)
- Access to Stripe Dashboard (https://dashboard.stripe.com)
- Your `.env.local` file ready for API keys

## 🔑 Step 1: Get Your API Keys

1. Log into Stripe Dashboard
2. Toggle between **Test mode** (for development) or **Live mode** (for production)
   - 💡 Start with Test mode for initial setup
3. Go to **Developers → API keys**
4. Copy these keys to your `.env.local`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...  # Secret key
   STRIPE_PUBLISHABLE_KEY=pk_test_...  # Publishable key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Same as above
   ```

## 📦 Step 2: Create Products and Prices

### Navigate to Products
1. Go to **Products** in Stripe Dashboard
2. Click **"+ Add product"** for each plan

### Create Each Product:

#### 1️⃣ Free Plan
- **Name**: `PixtorAI Free`
- **Description**: `5 daily AI operations with basic features`
- **Pricing**: 
  - Model: `Recurring`
  - Price: `$0.00`
  - Billing period: `Monthly`
- **Price ID**: Save this ID as `price_free_monthly`
- **Metadata** (optional but recommended):
  ```
  plan_id: free
  daily_limit: 5
  tier: lite
  ```

#### 2️⃣ Starter Plan
- **Name**: `PixtorAI Starter`
- **Description**: `50 daily AI operations with enhanced features`
- **Pricing**:
  - Model: `Recurring`
  - Price: `$4.99`
  - Billing period: `Monthly`
- **Price ID**: Save this ID (e.g., `price_1234567890abcdef`)
- **Metadata**:
  ```
  plan_id: starter
  daily_limit: 50
  tier: lite
  ```

#### 3️⃣ Creator Plan
- **Name**: `PixtorAI Creator`
- **Description**: `150 daily operations with advanced AI models`
- **Pricing**:
  - Model: `Recurring`
  - Price: `$9.99`
  - Billing period: `Monthly`
- **Price ID**: Save this ID
- **Metadata**:
  ```
  plan_id: creator
  daily_limit: 150
  tier: secondary
  ```

#### 4️⃣ Pro Plan
- **Name**: `PixtorAI Pro`
- **Description**: `300 daily operations with all premium features`
- **Pricing**:
  - Model: `Recurring`
  - Price: `$14.99`
  - Billing period: `Monthly`
- **Price ID**: Save this ID
- **Metadata**:
  ```
  plan_id: pro
  daily_limit: 300
  tier: premium
  ```

## 🔄 Step 3: Update Your Configuration

After creating products, update `/lib/config/subscription.ts` with the Stripe IDs:

```typescript
export const PLANS: Plan[] = [
  {
    id: 'free',
    // ... existing config
    stripeProductId: 'prod_ABC123',  // Your Free product ID
    stripePriceId: 'price_free_monthly',  // Your Free price ID
  },
  {
    id: 'starter',
    // ... existing config
    stripeProductId: 'prod_DEF456',  // Your Starter product ID
    stripePriceId: 'price_XYZ789',  // Your Starter price ID
  },
  // ... repeat for Creator and Pro
];
```

## 🪝 Step 4: Configure Webhooks

### Create Webhook Endpoint
1. Go to **Developers → Webhooks**
2. Click **"Add endpoint"**
3. Enter your endpoint URL:
   - **Development**: `https://[your-ngrok-url]/api/subscription/webhook`
   - **Production**: `https://yourdomain.com/api/subscription/webhook`

### Select Events to Listen For
Check these essential events:
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.trial_will_end` (if using trials)

### Get Webhook Secret
1. After creating the endpoint, click on it
2. Click **"Reveal signing secret"**
3. Copy to your `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## 🧪 Step 5: Test Your Setup

### Test Card Numbers
Use these in Test mode:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires auth**: `4000 0025 0000 3155`

### Test Checkout Flow
1. Visit your app at `http://localhost:3003`
2. Click on a paid plan
3. You should be redirected to Stripe Checkout
4. Use test card to complete payment
5. Check webhook events in Stripe Dashboard

### Verify Webhook Events
1. Go to **Developers → Webhooks → [Your endpoint]**
2. Check "Webhook attempts" to see if events are received
3. Look for successful (200) responses

## ⚙️ Step 6: Customer Portal Setup

Enable self-service subscription management:

1. Go to **Settings → Customer portal**
2. Enable the portal
3. Configure allowed actions:
   - ✅ Cancel subscriptions
   - ✅ Update payment methods
   - ✅ View invoices
   - ✅ Switch plans (optional)

## 📊 Step 7: Configure Billing Settings

1. Go to **Settings → Billing**
2. Configure:
   - **Invoice prefix**: `PIXTOR-`
   - **Payment methods**: Enable cards
   - **Customer emails**: Enable payment receipts
   - **Tax settings**: Configure if needed

## 🚀 Step 8: Going Live

When ready for production:

1. **Switch to Live mode** in Stripe Dashboard
2. **Create products again** in Live mode (Test and Live products are separate)
3. **Update `.env.local`** with Live keys:
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
4. **Create Live webhook** with your production URL
5. **Update webhook secret** in `.env.local`

## ✅ Verification Checklist

- [ ] Products created for all 4 plans
- [ ] Price IDs saved and updated in config
- [ ] Webhook endpoint configured
- [ ] Webhook secret in `.env.local`
- [ ] Test payment successful
- [ ] Webhook events received (check Dashboard)
- [ ] Customer portal enabled

## 🔍 Troubleshooting

### Webhook not receiving events?
- Check endpoint URL is correct
- Verify webhook secret matches
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3003/api/subscription/webhook`

### Checkout not working?
- Verify publishable key is correct
- Check browser console for errors
- Ensure products/prices exist in current mode (Test/Live)

### Subscription not updating in app?
- Check Firestore permissions
- Verify webhook is processing events
- Check server logs for errors

## 📱 Stripe CLI (Optional but Helpful)

Install Stripe CLI for local webhook testing:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3003/api/subscription/webhook

# Trigger test events
stripe trigger payment_intent.succeeded
```

## 🎉 Complete!

Your Stripe subscription system is now configured. Users can:
- Subscribe to plans
- Manage subscriptions via Customer Portal
- Receive payment receipts
- Have their usage limits automatically enforced

Next steps:
1. Test full payment flow with test cards
2. Monitor webhook events in Dashboard
3. Deploy to production when ready