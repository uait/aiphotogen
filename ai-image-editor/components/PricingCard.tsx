'use client';

import { useState } from 'react';
import { Check, Zap, Star, Crown } from 'lucide-react';
import { Plan } from '@/lib/types/subscription';
import { formatPrice } from '@/lib/config/subscription';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface PricingCardProps {
  plan: Plan;
  isCurrentPlan?: boolean;
  isPopular?: boolean;
  onUpgrade: (planId: string) => Promise<void>;
}

const PLAN_ICONS = {
  free: Zap,
  starter: Zap, 
  creator: Star,
  pro: Crown
};

const PLAN_COLORS = {
  free: 'text-gray-400',
  starter: 'text-[#00D4FF]',
  creator: 'text-[#7C3AED]',
  pro: 'text-[#10F88F]'
};

export default function PricingCard({ plan, isCurrentPlan, isPopular, onUpgrade }: PricingCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const Icon = PLAN_ICONS[plan.id as keyof typeof PLAN_ICONS] || Zap;
  const iconColor = PLAN_COLORS[plan.id as keyof typeof PLAN_COLORS];

  const handleUpgrade = async () => {
    if (!user) {
      toast.error('Please sign in to upgrade your plan');
      return;
    }
    
    if (isCurrentPlan) {
      return;
    }

    setLoading(true);
    try {
      await onUpgrade(plan.id);
    } catch (error) {
      console.error('Upgrade failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-4 sm:p-6 border transition-all duration-300 ${
      isPopular 
        ? 'border-[#00D4FF] shadow-lg shadow-[#00D4FF]/20 sm:scale-105' 
        : 'border-gray-700 hover:border-[#00D4FF]/50'
    }`}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-to-r from-[#00D4FF] to-[#7C3AED] text-white px-3 py-1 sm:px-4 sm:py-1 rounded-full text-xs sm:text-sm font-medium pixtor-glow">
            Most Popular
          </div>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-2 sm:right-4">
          <div className="bg-gradient-to-r from-[#10F88F] to-[#00D4FF] text-black px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
            Current
          </div>
        </div>
      )}

      <div className="text-center mb-4 sm:mb-6">
        <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 mb-3 sm:mb-4 ${iconColor}`}>
          <Icon size={20} className="sm:w-6 sm:h-6" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{plan.displayName}</h3>
        <div className="mb-3 sm:mb-4">
          {plan.price === 0 ? (
            <div className="text-2xl sm:text-4xl font-bold text-white">Free</div>
          ) : (
            <div className="flex items-baseline justify-center">
              <span className="text-2xl sm:text-4xl font-bold text-white">{formatPrice(plan.price)}</span>
              <span className="text-sm sm:text-base text-gray-400 ml-1">/{plan.interval}</span>
            </div>
          )}
        </div>
        
        <div className="text-center mb-4 sm:mb-6">
          <div className="text-base sm:text-lg font-semibold text-[#00D4FF] mb-1">
            {plan.dailyLimit} operations/day
          </div>
          <div className="text-xs sm:text-sm text-gray-400">
            Model access: {plan.allowedTiers.map(tier => 
              tier.charAt(0).toUpperCase() + tier.slice(1)
            ).join(', ')}
          </div>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
        {plan.features.map((feature) => (
          <div key={feature.id} className="flex items-start">
            <Check className="text-[#10F88F] mr-3 mt-0.5 flex-shrink-0" size={16} />
            <div>
              <div className="text-white text-sm font-medium">{feature.name}</div>
              {feature.description && (
                <div className="text-gray-400 text-xs">{feature.description}</div>
              )}
              {feature.limit && (
                <div className="text-[#00D4FF] text-xs">Limit: {feature.limit}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleUpgrade}
        disabled={loading || isCurrentPlan}
        className={`w-full py-2 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold transition-all duration-300 text-sm sm:text-base touch-manipulation ${
          isCurrentPlan
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : plan.price === 0
            ? 'bg-gradient-to-r from-gray-700 to-gray-600 text-white hover:from-gray-600 hover:to-gray-500'
            : isPopular
            ? 'pixtor-gradient text-white pixtor-gradient-hover pixtor-glow'
            : 'bg-gradient-to-r from-gray-800 to-gray-700 text-white hover:from-[#00D4FF]/20 hover:to-[#7C3AED]/20 hover:border-[#00D4FF]/30 border border-transparent'
        }`}
      >
        {loading ? (
          'Processing...'
        ) : isCurrentPlan ? (
          'Current Plan'
        ) : plan.price === 0 ? (
          user ? 'Current Plan' : 'Start Free'
        ) : (
          `Upgrade to ${plan.displayName}`
        )}
      </button>
    </div>
  );
}