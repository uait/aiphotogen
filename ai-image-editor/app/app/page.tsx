'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';
import ChatInterface from '@/components/ChatInterface';
import Sidebar from '@/components/Sidebar';
import PixtorLogo from '@/components/PixtorLogo';
import { Sparkles, Zap, CreditCard, Settings } from 'lucide-react';
import Link from 'next/link';

export default function App() {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      setShowAuthModal(true);
    }
  }, [loading, user]);

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    // Redirect to landing page if user is not authenticated
    if (!user) {
      window.location.href = '/';
    }
  };

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
          <PixtorLogo size="xl" animate={true} showText={false} className="justify-center mb-4" />
          <div className="text-xl font-semibold pixtor-text-gradient mb-2">PixtorAI</div>
          <p className="text-gray-400">Loading your creative workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen mobile-viewport-fix flex overflow-hidden">
      {user && (
        <Sidebar
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
        />
      )}
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="flex-shrink-0 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 pixtor-glow">
          <div className="flex items-center justify-between">
            <Link href="/">
              <PixtorLogo size="sm" animate={true} className="sm:size-md" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link 
                href="/pricing"
                className="hidden sm:inline text-gray-300 hover:text-[#00D4FF] transition-colors font-medium text-sm"
              >
                Pricing
              </Link>
              {user ? (
                <Link 
                  href="/account"
                  className="flex items-center gap-1 sm:gap-2 text-gray-300 hover:text-[#00D4FF] transition-colors text-sm"
                >
                  <Settings size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span className="hidden sm:inline">Account</span>
                </Link>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 pixtor-gradient text-white rounded-lg font-medium pixtor-gradient-hover transition-all duration-300 pixtor-glow text-sm"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          {user ? (
            <ChatInterface 
              conversationId={currentConversationId}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
              <div className="text-center max-w-lg mx-auto px-4">
                <div className="relative mb-8">
                  <PixtorLogo size="xxl" animate={true} showText={false} className="justify-center mb-4" />
                  <div className="absolute inset-0 flex justify-center items-center animate-ping opacity-20">
                    <PixtorLogo size="xxl" showText={false} />
                  </div>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 pixtor-text-gradient">Welcome to PixtorAI</h2>
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
        onClose={handleCloseAuthModal}
      />
    </div>
  );
}