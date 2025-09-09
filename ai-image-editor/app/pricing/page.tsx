'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PricingSection from '@/components/PricingSection';
import Link from 'next/link';

export default function PricingPage() {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(false);

  // Load user's current plan
  useEffect(() => {
    if (user) {
      loadCurrentPlan();
    }
  }, [user]);

  const loadCurrentPlan = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscription/usage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.plan.id);
      }
    } catch (error) {
      console.error('Failed to load current plan:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/app" 
              className="flex items-center gap-3 text-white hover:text-[#00D4FF] transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to PixtorAI</span>
            </Link>
            
            {user && (
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                  Signed in as {user.email || user.phoneNumber}
                </div>
                {loading && (
                  <div className="text-sm text-[#00D4FF]">Loading plan...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <PricingSection currentPlanId={currentPlan} />
      </main>
    </div>
  );
}