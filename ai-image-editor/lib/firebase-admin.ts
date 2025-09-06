// Firebase Admin SDK initialization
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

export function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    try {
      // Check if we have the required environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        console.warn('Firebase Admin credentials not configured. Subscription features will be disabled.');
        return null;
      }

      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      
      console.log('Firebase Admin initialized successfully');
      return adminApp;
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
      return null;
    }
  } else {
    adminApp = getApps()[0];
    return adminApp;
  }
}

export function getFirebaseAuth() {
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error('Firebase Admin not initialized');
  }
  return getAuth(app);
}

export async function verifyAuthToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}