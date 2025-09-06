'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AccountSection from '@/components/AccountSection';

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="flex items-center gap-3 text-white hover:text-[#00D4FF] transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to PixtorAI</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <AccountSection />
      </main>
    </div>
  );
}