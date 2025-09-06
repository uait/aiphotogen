// Firebase Admin SDK initialization for Cloud Functions
import * as admin from 'firebase-admin';

// Firebase Admin is already initialized in Cloud Functions
// We just need to ensure we can access the services

export function getFirebaseAuth() {
  return admin.auth();
}

export function getFirestore() {
  return admin.firestore();
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