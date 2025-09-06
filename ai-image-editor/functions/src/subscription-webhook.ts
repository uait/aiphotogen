import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia'
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const subscriptionWebhook = async (req: functions.Request, res: functions.Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });

  } catch (error: any) {
    console.error('Webhook handling error:', error);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
};

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId) {
    console.error('No user ID found in checkout session');
    return;
  }

  const db = admin.firestore();
  const subscriptionRef = db.collection('subscriptions').doc(userId);
  
  // Update user's subscription in Firestore
  await subscriptionRef.update({
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    status: 'active',
    updatedAt: admin.firestore.Timestamp.now()
  });
  
  console.log(`Subscription activated for user: ${userId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const db = admin.firestore();
  
  // Find user by Stripe customer ID
  const userQuery = db.collection('subscriptions')
    .where('stripeCustomerId', '==', customerId);
  
  const userDocs = await userQuery.get();
  
  if (userDocs.empty) {
    console.error('No user found for customer:', customerId);
    return;
  }

  const userDoc = userDocs.docs[0];
  const subscriptionRef = userDoc.ref;
  
  // Update subscription status
  await subscriptionRef.update({
    status: subscription.status,
    currentPeriodStart: admin.firestore.Timestamp.fromDate(
      new Date(subscription.current_period_start * 1000)
    ),
    currentPeriodEnd: admin.firestore.Timestamp.fromDate(
      new Date(subscription.current_period_end * 1000)
    ),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: admin.firestore.Timestamp.now()
  });
  
  console.log(`Subscription updated for customer: ${customerId}, status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const db = admin.firestore();
  
  // Find user by Stripe customer ID
  const userQuery = db.collection('subscriptions')
    .where('stripeCustomerId', '==', customerId);
  
  const userDocs = await userQuery.get();
  
  if (userDocs.empty) {
    console.error('No user found for customer:', customerId);
    return;
  }

  const userDoc = userDocs.docs[0];
  const subscriptionRef = userDoc.ref;
  
  // Downgrade to free plan
  await subscriptionRef.update({
    planId: 'free',
    status: 'canceled',
    stripeSubscriptionId: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.Timestamp.now()
  });
  
  console.log(`Subscription canceled for customer: ${customerId}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle successful payment
  console.log(`Payment succeeded for customer: ${invoice.customer}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed payment
  console.log(`Payment failed for customer: ${invoice.customer}`);
  
  const customerId = invoice.customer as string;
  const db = admin.firestore();
  
  // Find user by Stripe customer ID and update status
  const userQuery = db.collection('subscriptions')
    .where('stripeCustomerId', '==', customerId);
  
  const userDocs = await userQuery.get();
  
  if (!userDocs.empty) {
    const userDoc = userDocs.docs[0];
    const subscriptionRef = userDoc.ref;
    
    await subscriptionRef.update({
      status: 'past_due',
      updatedAt: admin.firestore.Timestamp.now()
    });
  }
}