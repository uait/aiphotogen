'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { X, Mail, Phone, Chrome } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationResult } from 'firebase/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTo?: string;
}

export default function AuthModal({ isOpen, onClose, redirectTo }: AuthModalProps) {
  const { signUp, signIn, signInWithGoogle, signInWithPhone, verifyOTP, setupRecaptcha } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [otp, setOTP] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Cleanup reCAPTCHA when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      // Clean up recaptcha verifier when modal closes
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (error) {
          console.warn('Error clearing recaptcha on modal close:', error);
        }
        window.recaptchaVerifier = null;
      }
      // Reset form states when modal closes
      setConfirmationResult(null);
      setOTP('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Format phone number to E.164 format
  const formatPhoneNumber = (phone: string, countryCode: string) => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If it already starts with country code digits, don't add it again
    const countryDigits = countryCode.replace(/\D/g, '');
    if (digits.startsWith(countryDigits)) {
      return `+${digits}`;
    }
    
    // Add country code
    return `${countryCode}${digits}`;
  };

  // Common country codes for the dropdown
  const countryCodes = [
    { code: '+1', country: 'US/CA', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+91', country: 'IN', flag: '🇮🇳' },
    { code: '+49', country: 'DE', flag: '🇩🇪' },
    { code: '+33', country: 'FR', flag: '🇫🇷' },
    { code: '+61', country: 'AU', flag: '🇦🇺' },
    { code: '+81', country: 'JP', flag: '🇯🇵' },
    { code: '+86', country: 'CN', flag: '🇨🇳' },
    { code: '+55', country: 'BR', flag: '🇧🇷' },
    { code: '+7', country: 'RU', flag: '🇷🇺' },
  ];

  const handleAuthSuccess = () => {
    onClose();
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        toast.success('Account created successfully!');
      } else {
        await signIn(email, password);
        toast.success('Signed in successfully!');
      }
      handleAuthSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Signed in with Google!');
      handleAuthSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate phone number
      if (!phoneNumber.trim()) {
        toast.error('Please enter a phone number');
        return;
      }

      // Format phone number to E.164 format
      const formattedPhone = formatPhoneNumber(phoneNumber, countryCode);
      console.log('Formatted phone number:', formattedPhone);
      
      // Basic validation for phone number length
      const digits = formattedPhone.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) {
        toast.error('Please enter a valid phone number');
        return;
      }

      // Clear any existing recaptcha verifier
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }

      // Set up recaptcha
      setupRecaptcha('recaptcha-container');
      const confirmation = await signInWithPhone(formattedPhone);
      setConfirmationResult(confirmation);
      toast.success('OTP sent to your phone!');
    } catch (error: any) {
      console.error('Phone auth error:', error);
      // Clear recaptcha on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    
    setLoading(true);
    try {
      await verifyOTP(confirmationResult, otp);
      toast.success('Phone verified successfully!');
      handleAuthSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl max-w-md w-full mx-2 sm:mx-0 p-4 sm:p-6 relative pixtor-glow border border-[#00D4FF]/20 max-h-[95vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl sm:text-2xl font-bold pixtor-text-gradient mb-4 sm:mb-6 pr-8">
          {mode === 'signin' ? 'Welcome Back to PixtorAI' : 'Join PixtorAI'}
        </h2>

        <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
          <button
            onClick={() => setAuthMethod('email')}
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${
              authMethod === 'email'
                ? 'pixtor-gradient text-white pixtor-glow'
                : 'bg-gray-800 text-gray-400 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 hover:text-white'
            }`}
          >
            <Mail className="inline mr-2" size={18} />
            Email
          </button>
          <button
            onClick={() => setAuthMethod('phone')}
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${
              authMethod === 'phone'
                ? 'pixtor-gradient text-white pixtor-glow'
                : 'bg-gray-800 text-gray-400 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 hover:text-white'
            }`}
          >
            <Phone className="inline mr-2" size={18} />
            Phone
          </button>
        </div>

        {authMethod === 'email' ? (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF] border border-gray-700 hover:border-[#00D4FF]/30 transition-all duration-300"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF] border border-gray-700 hover:border-[#00D4FF]/30 transition-all duration-300"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 pixtor-gradient text-white rounded-lg font-medium pixtor-gradient-hover transition-all duration-300 disabled:opacity-50 pixtor-glow"
            >
              {loading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
        ) : confirmationResult ? (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOTP(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF] border border-gray-700 hover:border-[#00D4FF]/30 transition-all duration-300"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 pixtor-gradient text-white rounded-lg font-medium pixtor-gradient-hover transition-all duration-300 disabled:opacity-50 pixtor-glow"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePhoneSignIn} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full sm:w-auto px-3 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF] border border-gray-700 hover:border-[#00D4FF]/30 transition-all duration-300 min-w-0 sm:min-w-[120px]"
              >
                {countryCodes.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => {
                  // Only allow digits, spaces, dashes, parentheses
                  const value = e.target.value.replace(/[^\d\s\-\(\)]/g, '');
                  setPhoneNumber(value);
                }}
                className="flex-1 min-w-0 px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF] border border-gray-700 hover:border-[#00D4FF]/30 transition-all duration-300"
                required
              />
            </div>
            <div className="text-xs sm:text-sm text-gray-400 break-words">
              Example: {countryCode === '+1' ? '(555) 123-4567' : countryCode === '+44' ? '20 7946 0958' : countryCode === '+91' ? '98765 43210' : 'Enter your phone number'}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 pixtor-gradient text-white rounded-lg font-medium pixtor-gradient-hover transition-all duration-300 disabled:opacity-50 pixtor-glow"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* Persistent reCAPTCHA container */}
        <div id="recaptcha-container" className="hidden"></div>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-4 w-full py-3 bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-lg font-medium hover:from-[#00D4FF]/10 hover:to-[#7C3AED]/10 hover:border-[#00D4FF]/30 border border-transparent transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Chrome size={20} />
            Google
          </button>
        </div>

        {authMethod === 'email' && (
          <p className="mt-6 text-center text-gray-400">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-[#00D4FF] hover:text-[#10F88F] font-medium transition-colors duration-300"
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}