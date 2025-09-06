'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';
import ChatInterface from '@/components/ChatInterface';
import Sidebar from '@/components/Sidebar';
import { Sparkles, Zap, CreditCard, Settings } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      setShowAuthModal(true);
    }
  }, [loading, user]);

  const handleNewChat = () => {
    setCurrentConversationId(null);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="text-center">
          <Zap className="w-16 h-16 mx-auto mb-4 animate-pulse pixtor-text-gradient" />
          <div className="text-xl font-semibold pixtor-text-gradient mb-2">PixtorAI</div>
          <p className="text-gray-400">Loading your creative workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      {user && (
        <Sidebar
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
        />
      )}
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="flex-shrink-0 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 px-6 py-4 pixtor-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-[#00D4FF] pixtor-glow" />
              <h1 className="text-2xl font-bold pixtor-text-gradient">
                PixtorAI
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/pricing"
                className="text-gray-300 hover:text-[#00D4FF] transition-colors font-medium"
              >
                Pricing
              </Link>
              {user ? (
                <Link 
                  href="/account"
                  className="flex items-center gap-2 text-gray-300 hover:text-[#00D4FF] transition-colors"
                >
                  <Settings size={18} />
                  Account
                </Link>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 pixtor-gradient text-white rounded-lg font-medium pixtor-gradient-hover transition-all duration-300 pixtor-glow"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col">
          {user ? (
            <ChatInterface 
              conversationId={currentConversationId}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
              <div className="text-center max-w-lg mx-auto px-4">
                <div className="relative mb-8">
                  <Zap className="w-24 h-24 text-[#00D4FF] mx-auto mb-4 pixtor-glow animate-pulse" />
                  <div className="absolute inset-0 w-24 h-24 mx-auto animate-ping">
                    <Zap className="w-24 h-24 text-[#10F88F] opacity-20" />
                  </div>
                </div>
                <h2 className="text-4xl font-bold mb-4 pixtor-text-gradient">Welcome to PixtorAI</h2>
                <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                  Transform your creative vision into reality with AI-powered image generation and editing. 
                  Create stunning visuals from text prompts or enhance your photos with intelligent tools.
                </p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-8 py-4 pixtor-gradient text-white rounded-xl font-semibold pixtor-gradient-hover transition-all duration-300 pixtor-glow text-lg"
                >
                  Start Creating
                </button>
                <div className="mt-8 flex justify-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#00D4FF] rounded-full animate-pulse"></div>
                    AI Generation
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#7C3AED] rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                    Smart Editing
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#10F88F] rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                    Instant Results
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
