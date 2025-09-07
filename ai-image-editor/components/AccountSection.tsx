'use client';

import { useState, useEffect } from 'react';
import { Settings, CreditCard, BarChart3, Calendar, Zap, Crown, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Plan, UserSubscription, GetUsageResponse } from '@/lib/types/subscription';
import { formatPrice } from '@/lib/config/subscription';
import toast from 'react-hot-toast';

const PLAN_ICONS = {
  free: Zap,
  starter: Zap,
  creator: Star, 
  pro: Crown
};

export default function AccountSection() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<GetUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUsageData();
    }
  }, [user]);

  const loadUsageData = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscription/usage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setUsage(data);
      } else {
        // Fallback for static deployment
        console.log('API routes not available, using default values');
        setUsage({
          today: { used: 0, limit: 50, remaining: 50 },
          thisMonth: { used: 0, projectedMonthly: 0 },
          plan: { 
            id: 'free', 
            name: 'Free', 
            displayName: 'Free', 
            price: 0, 
            currency: 'usd', 
            interval: 'month', 
            dailyLimit: 50,
            allowedTiers: ['lite'],
            features: [
              { id: '1', name: 'Basic Image Generation', description: '50 operations per day', enabled: true, limit: 50 }
            ],
            isActive: true,
            sortOrder: 1
          },
          subscription: { 
            id: 'default',
            userId: 'user',
            planId: 'free',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            cancelAtPeriodEnd: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    } catch (error: any) {
      console.error('Error loading usage:', error);
      // Fallback for static deployment
      setUsage({
        today: { used: 0, limit: 50, remaining: 50 },
        thisMonth: { used: 0, projectedMonthly: 0 },
        plan: { 
          id: 'free', 
          name: 'Free', 
          displayName: 'Free', 
          price: 0, 
          currency: 'usd', 
          interval: 'month', 
          dailyLimit: 50,
          allowedTiers: ['lite'],
          features: [
            { id: '1', name: 'Basic Image Generation', description: '50 operations per day', enabled: true, limit: 50 }
          ],
          isActive: true,
          sortOrder: 1
        },
        subscription: { 
          id: 'default',
          userId: 'user',
          planId: 'free',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!user) return;
    
    setPortalLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          returnUrl: window.location.origin
        })
      });

      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        // API route not available in static deployment
        toast.error('Billing portal not available in static deployment. Please use a server-side deployment for subscription features.');
      }
      
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error('Billing portal not available in static deployment');
    } finally {
      setPortalLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Account Required</h2>
          <p className="text-gray-400">Please sign in to view your account information</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading account information...</p>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-400">Failed to load account information</p>
          <button 
            onClick={loadUsageData}
            className="mt-4 px-4 py-2 bg-[#00D4FF] text-white rounded-lg hover:bg-[#00B8E6] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const Icon = PLAN_ICONS[usage.plan.id as keyof typeof PLAN_ICONS] || Zap;
  const usagePercentage = (usage.today.used / usage.today.limit) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold pixtor-text-gradient mb-2">Account Dashboard</h1>
        <p className="text-gray-400">Manage your PixtorAI subscription and usage</p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-6 border border-[#00D4FF]/20 pixtor-glow">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#00D4FF] to-[#7C3AED] rounded-xl flex items-center justify-center text-white">
              <Icon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">PixtorAI {usage.plan.displayName || usage.plan.name || 'Plan'}</h2>
              <p className="text-gray-400">
                {(usage.plan.price || 0) === 0 ? 'Free Plan' : `${formatPrice(usage.plan.price || 0)}/${usage.plan.interval || 'month'}`}
              </p>
            </div>
          </div>
          
          {(usage.plan.price || 0) > 0 && (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-500 transition-all duration-300"
            >
              <CreditCard size={16} />
              {portalLoading ? 'Loading...' : 'Manage Billing'}
            </button>
          )}
        </div>

        {/* Subscription Status */}
        {usage.subscription && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Status</div>
              <div className={`font-medium ${
                usage.subscription?.status === 'active' ? 'text-[#10F88F]' : 'text-yellow-400'
              }`}>
                {(usage.subscription?.status || 'free').charAt(0).toUpperCase() + (usage.subscription?.status || 'free').slice(1)}
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Next Billing</div>
              <div className="font-medium text-white">
                {(usage.plan.price || 0) === 0 ? 'N/A' : (usage.subscription?.currentPeriodEnd ? new Date(usage.subscription.currentPeriodEnd).toLocaleDateString() : 'N/A')}
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Model Access</div>
              <div className="font-medium text-[#00D4FF]">
                {usage.plan.allowedTiers?.map(tier => 
                  tier.charAt(0).toUpperCase() + tier.slice(1)
                ).join(', ') || 'Standard'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Usage */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="text-[#00D4FF]" size={24} />
            <h3 className="text-lg font-semibold text-white">Today's Usage</h3>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Operations Used</span>
              <span className="text-white">{usage.today.used} / {usage.today.limit}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  usagePercentage > 90 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                  usagePercentage > 70 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                  'bg-gradient-to-r from-[#00D4FF] to-[#10F88F]'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Remaining</span>
            <span className={`font-medium ${usage.today.remaining > 0 ? 'text-[#10F88F]' : 'text-red-400'}`}>
              {usage.today.remaining} operations
            </span>
          </div>
          
          {usage.today.remaining === 0 && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">
                You've reached your daily limit. Upgrade your plan for more operations!
              </p>
            </div>
          )}
        </div>

        {/* Monthly Stats */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-[#7C3AED]" size={24} />
            <h3 className="text-lg font-semibold text-white">This Month</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Used</span>
              <span className="text-white font-medium">{usage.thisMonth.used}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Projected</span>
              <span className="text-[#00D4FF] font-medium">{usage.thisMonth.projectedMonthly}</span>
            </div>
            
            <div className="pt-2 border-t border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Daily Average</div>
              <div className="text-white font-medium">
                {(usage.thisMonth.used / new Date().getDate()).toFixed(1)} operations/day
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Features */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Your Plan Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usage.plan.features?.map((feature) => (
            <div key={feature.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
              <div className="w-2 h-2 bg-[#10F88F] rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-white">{feature.name}</div>
                {feature.description && (
                  <div className="text-xs text-gray-400 mt-1">{feature.description}</div>
                )}
                {feature.limit && (
                  <div className="text-xs text-[#00D4FF] mt-1">Limit: {feature.limit}</div>
                )}
              </div>
            </div>
          )) || (
            <div className="col-span-full text-center text-gray-400">
              No features available
            </div>
          )}
        </div>
      </div>

      {/* Upgrade CTA for free users */}
      {(usage.plan?.id || 'free') === 'free' && (
        <div className="bg-gradient-to-r from-[#00D4FF]/10 to-[#7C3AED]/10 border border-[#00D4FF]/20 rounded-xl p-6 text-center">
          <h3 className="text-xl font-bold pixtor-text-gradient mb-2">Ready for More Power?</h3>
          <p className="text-gray-300 mb-4">
            Upgrade to unlock higher limits, better models, and advanced features
          </p>
          <button
            onClick={() => window.location.href = '/#pricing'}
            className="px-6 py-3 pixtor-gradient text-white rounded-lg font-medium pixtor-gradient-hover transition-all duration-300 pixtor-glow"
          >
            View Pricing Plans
          </button>
        </div>
      )}
    </div>
  );
}