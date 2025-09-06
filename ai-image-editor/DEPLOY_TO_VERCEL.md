# 🚀 Deploy PixtorAI to Vercel

Your application is now ready for deployment! Here are the exact steps to get it live.

## 📋 Quick Deployment Steps

### 1️⃣ Deploy via Vercel Dashboard (Recommended - 2 minutes)

1. **Visit**: https://vercel.com
2. **Click**: "New Project" 
3. **Import**: Your Git repository (GitHub/GitLab/BitBucket)
4. **Configure**:
   - Framework: Next.js (auto-detected)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)
5. **Click**: "Deploy"

**That's it!** Vercel will build and deploy automatically.

---

### 2️⃣ Deploy via CLI (Alternative)

If you prefer CLI deployment:

```bash
# Login to Vercel (will open browser)
vercel login

# Deploy to production
vercel --prod
```

---

## 🔧 Environment Variables Setup

After deployment, **immediately** add your environment variables:

### In Vercel Dashboard:
1. Go to your project
2. **Settings → Environment Variables**
3. Add **all** these variables from your `.env.local`:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email  
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_... # or sk_test_ for testing
STRIPE_PUBLISHABLE_KEY=pk_live_... # or pk_test_ for testing
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... # Same as STRIPE_PUBLISHABLE_KEY

# Gemini AI (if configured)
GEMINI_API_KEY=your-gemini-key
```

### ⚠️ Important Notes:
- Set **Environment**: `Production` for all variables
- For `FIREBASE_PRIVATE_KEY`: Copy the entire key including quotes and newlines
- For testing: Use `sk_test_` and `pk_test_` keys initially

---

## 🪝 Configure Webhooks

After deployment, update your Stripe webhook URL:

1. **Go to**: Stripe Dashboard → Developers → Webhooks
2. **Update endpoint URL** to: `https://your-app-name.vercel.app/api/subscription/webhook`
3. **Test webhook**: Send test event to verify it's working

---

## ✅ Deployment Checklist

- [ ] **Deploy**: App deployed to Vercel
- [ ] **Environment**: All variables added in Vercel Dashboard  
- [ ] **Webhook**: Stripe webhook URL updated
- [ ] **Test**: Visit your live app
- [ ] **Subscription**: Test a subscription flow
- [ ] **Usage**: Verify usage tracking works

---

## 🔗 Your App URLs

After deployment, you'll have:

```
Production:  https://your-app-name.vercel.app
Preview:     https://your-app-name-git-main.vercel.app
```

---

## 🧪 Testing Your Deployed App

### Test Subscription System:
1. **Visit**: `https://your-app.vercel.app/pricing`
2. **Sign up**: Create account with phone auth
3. **Subscribe**: Try upgrading to a paid plan (use test card: `4242 4242 4242 4242`)
4. **Generate**: Create an image to test usage tracking
5. **Check**: Verify usage appears in sidebar

### Test API Endpoints:
- `GET /api/subscription/usage` - Should require auth
- `POST /api/subscription/webhook` - Should handle Stripe events
- `POST /api/generate-image-v2` - Should track usage

---

## 🎉 You're Live!

Once deployed:
- ✅ Users can sign up and subscribe
- ✅ Stripe handles all payments
- ✅ Usage limits are enforced
- ✅ Firebase stores user data
- ✅ Real-time usage tracking works

---

## 🚨 If Something Goes Wrong

### Common Issues:

1. **Build fails**: Check build logs in Vercel Dashboard
2. **API errors**: Verify all environment variables are set
3. **Stripe webhook fails**: Check webhook URL matches your domain
4. **Firebase errors**: Verify service account credentials

### Debug Steps:
1. Check Vercel **Functions** tab for API errors
2. Test API endpoints directly: `curl https://your-app.vercel.app/api/subscription/usage`
3. Monitor Stripe webhook attempts in Stripe Dashboard
4. Check browser Network tab for client-side errors

---

## 📊 Current Build Status

✅ **Application built successfully**  
✅ **All API routes configured**  
✅ **Subscription system complete**  
✅ **Ready for production deployment**

**Next**: Deploy to Vercel and add environment variables!