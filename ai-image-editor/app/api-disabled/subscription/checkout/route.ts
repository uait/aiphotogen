// Stripe Checkout Session API
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase-admin';
import { StripeService } from '@/lib/services/stripe';
import { CreateCheckoutSessionRequest } from '@/lib/types/subscription';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const userId = await verifyAuthToken(authHeader);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json() as CreateCheckoutSessionRequest;
    const { planId, successUrl, cancelUrl } = body;

    if (!planId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, successUrl, cancelUrl' },
        { status: 400 }
      );
    }

    // Get user info for customer creation (optional)
    const userEmail = request.headers.get('x-user-email');
    const userName = request.headers.get('x-user-name');

    const stripeService = StripeService.getInstance();
    const session = await stripeService.createCheckoutSession(
      userId,
      { planId, successUrl, cancelUrl },
      userEmail || undefined,
      userName || undefined
    );

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('Checkout session creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}