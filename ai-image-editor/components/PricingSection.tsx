'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import PricingCard from './PricingCard';
import { Plan } from '@/lib/types/subscription';
import { PLANS } from '@/lib/config/subscription';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PricingSectionProps {
  currentPlanId?: string;
  className?: string;
}

export default function PricingSection({ currentPlanId = 'free', className = '' }: PricingSectionProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (planId: string) => {
    if (!user) {
      toast.error('Please sign in to upgrade your plan');
      return;
    }

    if (planId === 'free') {
      return; // No upgrade needed for free plan
    }

    setLoading(true);
    try {
      // Get user's auth token
      const token = await user.getIdToken();
      
      // Create checkout session
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-email': user.email || '',
          'x-user-name': user.displayName || ''
        },
        body: JSON.stringify({
          planId,
          successUrl: `${window.location.origin}/?success=true&plan=${planId}`,
          cancelUrl: `${window.location.origin}/?canceled=true`
        })
      });

      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const { url } = await response.json();
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        // API route not available in static deployment
        throw new Error('Subscription checkout not available in static deployment. Please use a server-side deployment for full functionality.');
      }
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout process');
    } finally {
      setLoading(false);
    }
  };

  // Check for success/cancel parameters in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const plan = urlParams.get('plan');

    if (success) {
      toast.success(`Successfully upgraded to ${plan}! Welcome to PixtorAI ${plan}!`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canceled) {
      toast.error('Upgrade canceled. You can try again anytime!');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className={`py-12 px-4 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold pixtor-text-gradient mb-4">
            Choose Your Creative Power
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Unlock your artistic potential with PixtorAI's AI-powered image generation and editing tools. 
            From basic creations to professional-grade outputs.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {PLANS.filter(plan => plan.isActive).map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={plan.id === currentPlanId}
              isPopular={plan.id === 'creator'} // Mark Creator as popular
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-[#00D4FF] mb-3">
                  What happens when I reach my daily limit?
                </h4>
                <p className="text-gray-300">
                  Your daily usage resets every day at midnight Eastern Time. You can upgrade your plan anytime 
                  for higher limits, or wait until the next day for your quota to refresh.
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-[#00D4FF] mb-3">
                  Can I change or cancel my plan?
                </h4>
                <p className="text-gray-300">
                  Yes! You can upgrade, downgrade, or cancel your subscription anytime. Changes take effect 
                  at your next billing cycle, and you can manage everything through your account dashboard.
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-[#00D4FF] mb-3">
                  What's the difference between model tiers?
                </h4>
                <p className="text-gray-300">
                  Lite models are fast and efficient for basic needs. Secondary models provide higher quality 
                  and better detail. Premium models offer the best quality, HD output, and advanced features like inpainting.
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-[#00D4FF] mb-3">
                  Do you offer refunds?
                </h4>
                <p className="text-gray-300">
                  We offer a 7-day money-back guarantee for all paid plans. If you're not satisfied, 
                  contact our support team and we'll process your refund quickly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 text-center">
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#10F88F] rounded-full"></div>
              Secure payments with Stripe
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00D4FF] rounded-full"></div>
              Cancel anytime
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#7C3AED] rounded-full"></div>
              7-day money-back guarantee
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}