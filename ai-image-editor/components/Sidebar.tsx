'use client';

import { useState, useEffect } from 'react';
import { Clock, Trash2, Plus, LogOut, Menu, X, BarChart3, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: any;
  thumbnail?: string;
  type: 'text' | 'image';
}

interface SidebarProps {
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
}

export default function Sidebar({ onNewChat, onSelectConversation }: SidebarProps) {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Get unique conversations from messages
    const q = query(
      collection(db, 'messages'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const conversationMap = new Map<string, Conversation>();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const convId = data.conversationId;
          
          if (convId && !conversationMap.has(convId)) {
            // Determine conversation type from conversationType field or conversation ID prefix
            const conversationType = data.conversationType || 
              (convId.startsWith('image_') ? 'image' : 
               convId.startsWith('text_') ? 'text' : 
               (data.images || data.generatedImage ? 'image' : 'text'));
            
            // Create conversation summary from first message
            conversationMap.set(convId, {
              id: convId,
              title: data.text?.substring(0, 50) || (conversationType === 'image' ? 'Image Chat' : 'Text Chat'),
              lastMessage: data.text || (conversationType === 'image' ? 'Image conversation' : 'Text conversation'),
              timestamp: data.timestamp?.toDate() || new Date(),
              thumbnail: data.images?.[0] || data.generatedImage,
              type: conversationType
            });
          }
        });
        
        const convos = Array.from(conversationMap.values());
        convos.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setConversations(convos);
      },
      (error) => {
        console.error('Firestore error in sidebar:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Load usage data
  useEffect(() => {
    if (!user) return;
    loadUsageData();
  }, [user]);

  const loadUsageData = async () => {
    if (!user) return;
    
    setLoadingUsage(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscription/usage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setUsage(data.today);
        } else {
          // API endpoint returned non-JSON response
          console.log('API endpoint returned non-JSON response, using fallback data');
          setUsage({ used: 0, limit: 50, remaining: 50 }); // Default free tier values
        }
      } else {
        // Fallback for static deployment
        setUsage({ used: 0, limit: 50, remaining: 50 });
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
      // Fallback for static deployment
      setUsage({ used: 0, limit: 50, remaining: 50 });
    } finally {
      setLoadingUsage(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        where('userId', '==', user.uid)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      
      for (const messageDoc of messagesSnapshot.docs) {
        const data = messageDoc.data();
        
        // Delete associated images from storage
        if (data.images) {
          for (const imageUrl of data.images) {
            try {
              const imagePath = decodeURIComponent(imageUrl.split('/o/')[1].split('?')[0]);
              const imageRef = ref(storage, imagePath);
              await deleteObject(imageRef);
            } catch (error) {
              console.error('Error deleting image:', error);
            }
          }
        }
        
        if (data.generatedImage) {
          try {
            // Handle localStorage-stored images
            if (data.generatedImage.startsWith('local:')) {
              const imageKey = data.generatedImage.replace('local:', '');
              localStorage.removeItem(imageKey);
              console.log('Removed localStorage image:', imageKey);
            } else if (data.generatedImage.includes('/o/')) {
              // Handle Firebase Storage URLs
              const imagePath = decodeURIComponent(data.generatedImage.split('/o/')[1].split('?')[0]);
              const imageRef = ref(storage, imagePath);
              await deleteObject(imageRef);
            }
          } catch (error) {
            console.error('Error deleting generated image:', error);
          }
        }
        
        // Delete message document
        await deleteDoc(doc(db, 'messages', messageDoc.id));
      }
      
      toast.success('Conversation deleted successfully');
    } catch (error) {
      toast.error('Failed to delete conversation');
      console.error('Error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-lg pixtor-glow"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div className={`fixed lg:relative inset-y-0 left-0 w-64 bg-gradient-to-b from-gray-900 via-gray-800 to-black border-r border-[#00D4FF]/20 flex flex-col transition-transform z-40 h-full max-h-screen pixtor-glow ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-4 border-b border-[#00D4FF]/20">
          <button
            onClick={onNewChat}
            className="w-full py-3 pixtor-gradient text-white rounded-lg font-medium pixtor-gradient-hover transition-all duration-300 pixtor-glow flex items-center justify-center gap-2 mb-4"
          >
            <Plus size={20} />
            New Chat
          </button>

          {/* Usage Indicator */}
          {usage && (
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-3 border border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={16} className="text-[#00D4FF]" />
                <span className="text-sm font-medium text-white">Today's Usage</span>
              </div>
              <div className="flex justify-between text-xs text-gray-300 mb-2">
                <span>{usage.used} / {usage.limit}</span>
                <span>{usage.remaining} left</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    usage.remaining === 0 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                    usage.remaining < usage.limit * 0.2 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                    'bg-gradient-to-r from-[#00D4FF] to-[#10F88F]'
                  }`}
                  style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                ></div>
              </div>
              {usage.remaining === 0 && (
                <div className="mt-2 text-xs text-red-400 font-medium">
                  Daily limit reached
                </div>
              )}
            </div>
          )}

          {loadingUsage && (
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-3 border border-gray-600">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="animate-spin w-4 h-4 border border-[#00D4FF] border-t-transparent rounded-full"></div>
                Loading usage...
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-thin">
          {/* Text Conversations Section */}
          <div className="mb-6">
            <h3 className="text-[#00D4FF] text-sm font-medium mb-3 flex items-center gap-2">
              <MessageSquare size={16} />
              Text Chats
            </h3>
            
            {conversations.filter(convo => convo.type === 'text').length === 0 ? (
              <p className="text-gray-600 text-sm mb-4">No text conversations yet</p>
            ) : (
              <div className="space-y-2 mb-4">
                {conversations.filter(convo => convo.type === 'text').map((convo) => (
                  <div
                    key={convo.id}
                    onClick={() => onSelectConversation(convo.id)}
                    className="group p-3 bg-gradient-to-r from-blue-900/20 to-cyan-900/20 rounded-lg hover:from-blue-800/30 hover:to-cyan-800/30 hover:border-blue-400/30 transition-all duration-300 cursor-pointer border border-blue-900/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare size={14} className="text-blue-400 flex-shrink-0" />
                          <h4 className="text-white font-medium truncate">
                            {convo.title}
                          </h4>
                        </div>
                        <p className="text-gray-400 text-sm truncate">
                          {convo.lastMessage}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(convo.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Image Conversations Section */}
          <div>
            <h3 className="text-[#00D4FF] text-sm font-medium mb-3 flex items-center gap-2">
              <ImageIcon size={16} />
              Image Chats
            </h3>
            
            {conversations.filter(convo => convo.type === 'image').length === 0 ? (
              <p className="text-gray-600 text-sm">No image conversations yet</p>
            ) : (
              <div className="space-y-2">
                {conversations.filter(convo => convo.type === 'image').map((convo) => (
                  <div
                    key={convo.id}
                    onClick={() => onSelectConversation(convo.id)}
                    className="group p-3 bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg hover:from-purple-800/30 hover:to-pink-800/30 hover:border-purple-400/30 transition-all duration-300 cursor-pointer border border-purple-900/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ImageIcon size={14} className="text-purple-400 flex-shrink-0" />
                          <h4 className="text-white font-medium truncate">
                            {convo.title}
                          </h4>
                        </div>
                        <p className="text-gray-400 text-sm truncate">
                          {convo.lastMessage}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(convo.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {convo.thumbnail && !convo.thumbnail.startsWith('local:') && (
                      <div className="mt-2">
                        <img
                          src={convo.thumbnail}
                          alt="Thumbnail"
                          className="w-full h-20 object-cover rounded"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {user && (
          <div className="p-4 border-t border-[#00D4FF]/20 bg-gradient-to-r from-gray-900 to-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 pixtor-gradient rounded-full flex items-center justify-center text-white font-medium pixtor-glow">
                {user.email?.[0].toUpperCase() || user.phoneNumber?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">
                  {user.email || user.phoneNumber}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-2 bg-gradient-to-r from-gray-800 to-gray-700 text-gray-300 rounded-lg hover:from-red-600/20 hover:to-red-500/20 hover:text-red-400 hover:border-red-500/30 border border-transparent transition-all duration-300 flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        )}
      </div>
    </>
  );
}