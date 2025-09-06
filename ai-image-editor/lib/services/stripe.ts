// PixtorAI Stripe Integration Service
import Stripe from 'stripe';
import { 
  UserSubscription, 
  Plan, 
  SubscriptionStatus,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  StripeWebhookEvent 
} from '../types/subscription';
import { SUBSCRIPTION_CONFIG, getPlanById } from '../config/subscription';
import { SubscriptionService } from './subscription';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export class StripeService {
  private static instance: StripeService;
  private subscriptionService = SubscriptionService.getInstance();
  
  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  // Create or get Stripe customer
  async getOrCreateCustomer(userId: string, email?: string, name?: string): Promise<string> {
    try {
      // Check if customer already exists
      const subscription = await this.subscriptionService.getUserSubscription(userId);
      if (subscription?.stripeCustomerId) {
        return subscription.stripeCustomerId;
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          pixtorai_user_id: userId
        }
      });

      // Update subscription with customer ID
      await this.subscriptionService.updateUserSubscription(userId, {
        stripeCustomerId: customer.id
      });

      return customer.id;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  // Create checkout session
  async createCheckoutSession(
    userId: string,
    request: CreateCheckoutSessionRequest,
    customerEmail?: string,
    customerName?: string
  ): Promise<CreateCheckoutSessionResponse> {
    try {
      const plan = getPlanById(request.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${request.planId}`);
      }

      if (!plan.stripePriceId) {
        throw new Error(`Stripe price ID not configured for plan: ${request.planId}`);
      }

      const customerId = await this.getOrCreateCustomer(userId, customerEmail, customerName);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        metadata: {
          pixtorai_user_id: userId,
          pixtorai_plan_id: request.planId
        },
        subscription_data: {
          metadata: {
            pixtorai_user_id: userId,
            pixtorai_plan_id: request.planId
          }
        },
        billing_address_collection: 'required',
        automatic_tax: {
          enabled: true,
        },
      });

      if (!session.url) {
        throw new Error('Failed to create checkout session URL');
      }

      return {
        sessionId: session.id,
        url: session.url
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  // Create customer portal session
  async createPortalSession(userId: string, returnUrl: string): Promise<{ url: string }> {
    try {
      const subscription = await this.subscriptionService.getUserSubscription(userId);
      if (!subscription?.stripeCustomerId) {
        throw new Error('No Stripe customer found for user');
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: returnUrl,
      });

      return { url: session.url };
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }

  // Handle webhook events
  async handleWebhook(event: StripeWebhookEvent): Promise<void> {
    try {
      console.log(`Processing Stripe webhook: ${event.type}`);

      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event);
          break;
        
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event);
          break;
        
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event);
          break;
        
        default:
          console.log(`Unhandled webhook type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error handling webhook ${event.type}:`, error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(event: StripeWebhookEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.pixtorai_user_id;
    const planId = subscription.metadata?.pixtorai_plan_id;

    if (!userId || !planId) {
      console.error('Missing metadata in subscription created event');
      return;
    }

    await this.subscriptionService.updateUserSubscription(userId, {
      planId,
      status: this.mapStripeStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    console.log(`Subscription created for user ${userId}: ${planId}`);
  }

  private async handleSubscriptionUpdated(event: StripeWebhookEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.pixtorai_user_id;

    if (!userId) {
      console.error('Missing user ID in subscription updated event');
      return;
    }

    // Handle plan changes
    const newPlanId = subscription.metadata?.pixtorai_plan_id;
    if (newPlanId) {
      await this.subscriptionService.updateUserSubscription(userId, {
        planId: newPlanId,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });

      console.log(`Subscription updated for user ${userId}: ${newPlanId}`);
    }
  }

  private async handleSubscriptionCanceled(event: StripeWebhookEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.pixtorai_user_id;

    if (!userId) {
      console.error('Missing user ID in subscription canceled event');
      return;
    }

    await this.subscriptionService.updateUserSubscription(userId, {
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: true
    });

    console.log(`Subscription canceled for user ${userId}`);
  }

  private async handlePaymentSucceeded(event: StripeWebhookEvent): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string;

    if (!subscriptionId) return;

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata?.pixtorai_user_id;

      if (userId) {
        await this.subscriptionService.updateUserSubscription(userId, {
          status: this.mapStripeStatus(subscription.status),
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });

        console.log(`Payment succeeded for user ${userId}`);
      }
    } catch (error) {
      console.error('Error handling payment succeeded:', error);
    }
  }

  private async handlePaymentFailed(event: StripeWebhookEvent): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string;

    if (!subscriptionId) return;

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata?.pixtorai_user_id;

      if (userId) {
        await this.subscriptionService.updateUserSubscription(userId, {
          status: SubscriptionStatus.PAST_DUE
        });

        console.log(`Payment failed for user ${userId}`);
      }
    } catch (error) {
      console.error('Error handling payment failed:', error);
    }
  }

  private async handleCheckoutCompleted(event: StripeWebhookEvent): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.pixtorai_user_id;
    const planId = session.metadata?.pixtorai_plan_id;

    if (!userId || !planId) {
      console.error('Missing metadata in checkout completed event');
      return;
    }

    // The subscription created webhook will handle the main updates
    console.log(`Checkout completed for user ${userId}: ${planId}`);
  }

  // Map Stripe subscription status to our enum
  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED
    };

    return statusMap[stripeStatus] || SubscriptionStatus.ACTIVE;
  }

  // Admin: Create products and prices in Stripe
  async createStripeProducts(): Promise<void> {
    try {
      console.log('Creating Stripe products and prices...');
      
      for (const plan of SUBSCRIPTION_CONFIG.plans) {
        if (plan.price === 0) continue; // Skip free plan

        // Create product
        const product = await stripe.products.create({
          id: `pixtorai_${plan.id}`,
          name: `PixtorAI ${plan.displayName}`,
          description: `${plan.dailyLimit} daily operations with ${plan.allowedTiers.join(', ')} model access`,
          metadata: {
            pixtorai_plan_id: plan.id
          }
        });

        // Create price
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.price,
          currency: plan.currency,
          recurring: {
            interval: plan.interval
          },
          metadata: {
            pixtorai_plan_id: plan.id
          }
        });

        console.log(`Created product ${product.id} with price ${price.id} for plan ${plan.id}`);
      }

      console.log('Stripe products and prices created successfully');
    } catch (error) {
      console.error('Error creating Stripe products:', error);
      throw error;
    }
  }

  // Get subscription info from Stripe
  async getStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Error retrieving Stripe subscription:', error);
      return null;
    }
  }

  // Cancel subscription
  async cancelSubscription(userId: string, cancelAtPeriodEnd = true): Promise<void> {
    try {
      const subscription = await this.subscriptionService.getUserSubscription(userId);
      if (!subscription?.stripeSubscriptionId) {
        throw new Error('No Stripe subscription found');
      }

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      });

      await this.subscriptionService.updateUserSubscription(userId, {
        cancelAtPeriodEnd
      });

      console.log(`Subscription ${cancelAtPeriodEnd ? 'scheduled for cancellation' : 'canceled immediately'} for user ${userId}`);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Reactivate subscription
  async reactivateSubscription(userId: string): Promise<void> {
    try {
      const subscription = await this.subscriptionService.getUserSubscription(userId);
      if (!subscription?.stripeSubscriptionId) {
        throw new Error('No Stripe subscription found');
      }

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false
      });

      await this.subscriptionService.updateUserSubscription(userId, {
        cancelAtPeriodEnd: false,
        status: SubscriptionStatus.ACTIVE
      });

      console.log(`Subscription reactivated for user ${userId}`);
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  }
}