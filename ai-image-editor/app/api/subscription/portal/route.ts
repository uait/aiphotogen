// Stripe Customer Portal API
import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'firebase-admin/auth';
import { StripeService } from '@/lib/services/stripe';

// Initialize Firebase Admin if not already done
if (!process.env.FIREBASE_ADMIN_INITIALIZED) {
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  
  if (getApps().length === 0) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
      process.env.FIREBASE_ADMIN_INITIALIZED = 'true';
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
    }
  }
}

async function verifyAuthToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decodedToken = await auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

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

    const { returnUrl } = await request.json();

    if (!returnUrl) {
      return NextResponse.json(
        { error: 'Missing required field: returnUrl' },
        { status: 400 }
      );
    }

    const stripeService = StripeService.getInstance();
    const session = await stripeService.createPortalSession(userId, returnUrl);

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('Portal session creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}