// User Usage and Subscription Info API
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase-admin';
import { SubscriptionService } from '@/lib/services/subscription';
import { GetUsageResponse } from '@/lib/types/subscription';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const subscriptionService = SubscriptionService.getInstance();
    
    // Get current plan and subscription
    const [plan, subscription, todayUsage] = await Promise.all([
      subscriptionService.getUserPlan(userId),
      subscriptionService.getUserSubscription(userId),
      subscriptionService.getTodayUsage(userId)
    ]);

    // Get monthly usage stats
    const last30DaysUsage = await subscriptionService.getUsageStats(userId, 30);
    const monthlyUsageTotal = last30DaysUsage.reduce((sum, day) => sum + day.operations, 0);
    
    // Calculate projected monthly usage
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const projectedMonthly = Math.round((monthlyUsageTotal / dayOfMonth) * daysInMonth);

    const response: GetUsageResponse = {
      today: {
        used: todayUsage.usedOperations,
        limit: plan.dailyLimit,
        remaining: Math.max(0, plan.dailyLimit - todayUsage.usedOperations)
      },
      thisMonth: {
        used: monthlyUsageTotal,
        projectedMonthly
      },
      plan,
      subscription: subscription!
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Usage retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve usage information' },
      { status: 500 }
    );
  }
}