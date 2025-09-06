'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithPhoneNumber,
  ConfirmationResult,
  RecaptchaVerifier,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  setupRecaptcha: (elementId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: new Date().toISOString(),
          });
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: userCredential.user.email,
      createdAt: new Date().toISOString(),
    });
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await setDoc(doc(db, 'users', result.user.uid), {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  };

  const setupRecaptcha = (elementId: string) => {
    // Clear any existing verifier first
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (error) {
        console.warn('Error clearing existing recaptcha:', error);
      }
      window.recaptchaVerifier = null;
    }

    // Check if the element exists
    const element = document.getElementById(elementId);
    if (!element) {
      console.error('Recaptcha element not found:', elementId);
      return;
    }

    try {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, elementId, {
        size: 'invisible',
        callback: () => {
          console.log('Recaptcha solved');
        },
        'expired-callback': () => {
          console.log('Recaptcha expired');
        },
        'error-callback': (error: any) => {
          console.error('Recaptcha error:', error);
        }
      });
    } catch (error) {
      console.error('Error setting up recaptcha:', error);
      throw error;
    }
  };

  const signInWithPhone = async (phoneNumber: string) => {
    if (!window.recaptchaVerifier) {
      throw new Error('Recaptcha not initialized');
    }
    
    console.log('Attempting phone sign-in with:', phoneNumber);
    console.log('Auth domain:', auth.app.options.authDomain);
    console.log('Project ID:', auth.app.options.projectId);
    
    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
      console.log('Phone sign-in successful, confirmation result received');
      return result;
    } catch (error: any) {
      console.error('Phone sign-in error details:', {
        code: error.code,
        message: error.message,
        details: error
      });
      throw error;
    }
  };

  const verifyOTP = async (confirmationResult: ConfirmationResult, otp: string) => {
    const result = await confirmationResult.confirm(otp);
    await setDoc(doc(db, 'users', result.user.uid), {
      phoneNumber: result.user.phoneNumber,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithPhone,
    verifyOTP,
    logout,
    setupRecaptcha,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}