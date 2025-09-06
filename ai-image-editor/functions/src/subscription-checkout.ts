import * as functions from 'firebase-functions';
import { verifyAuthToken } from './firebase-admin';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-08-27.basil'
  });
}

export const subscriptionCheckout = async (req: functions.Request, res: functions.Response) => {
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

    const { planId, successUrl, cancelUrl } = req.body;
    
    if (!planId || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'Missing required fields: planId, successUrl, cancelUrl'
      });
    }

    // Map plan IDs to Stripe price IDs (you'll need to set these up in Stripe)
    const planPriceMapping: { [key: string]: string } = {
      'starter': process.env.STRIPE_STARTER_PRICE_ID || 'price_1234starter',
      'creator': process.env.STRIPE_CREATOR_PRICE_ID || 'price_1234creator', 
      'pro': process.env.STRIPE_PRO_PRICE_ID || 'price_1234pro'
    };

    const priceId = planPriceMapping[planId];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    // Create Stripe Checkout Session
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        planId: planId
      }
    });

    return res.json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create checkout session'
    });
  }
};