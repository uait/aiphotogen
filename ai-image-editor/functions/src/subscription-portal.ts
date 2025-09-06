import * as functions from 'firebase-functions';
import { verifyAuthToken } from './firebase-admin';
import { SubscriptionService } from './subscription-service';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia'
});

export const subscriptionPortal = async (req: functions.Request, res: functions.Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    const userId = await verifyAuthToken(authHeader || null);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { returnUrl } = req.body;
    
    if (!returnUrl) {
      return res.status(400).json({
        error: 'Missing required field: returnUrl'
      });
    }

    // Get user's subscription to find Stripe customer ID
    const subscriptionService = SubscriptionService.getInstance();
    const subscription = await subscriptionService.getUserSubscription(userId);
    
    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({
        error: 'No subscription found. Please subscribe first.'
      });
    }

    // Create Stripe billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return res.json({
      url: session.url
    });

  } catch (error: any) {
    console.error('Portal error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create billing portal session'
    });
  }
};