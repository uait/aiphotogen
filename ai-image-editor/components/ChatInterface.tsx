'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Upload, Camera, Download, Trash2, Sparkles, Image as ImageIcon, MessageSquare, Bot, User, Plus, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MemoryManagementService } from '@/lib/services/MemoryManagementService';
import { Message as MemoryMessage, ConversationMetadata } from '@/lib/types/memory';

interface Message {
  id: string;
  text?: string;
  images?: string[];
  generatedImage?: string;
  originalImages?: string[]; // Store original uploaded images for context
  isUser: boolean;
  timestamp: any;
  isLoading?: boolean;
  conversationType?: 'text' | 'image'; // Track what type of conversation this message belongs to
}

interface ChatInterfaceProps {
  conversationId?: string | null;
}

export default function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [autoAddedImages, setAutoAddedImages] = useState<{url: string, id: string}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'photo'>('chat');
  const [showOriginals, setShowOriginals] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Memory management service
  const memoryService = MemoryManagementService.getInstance();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages for current conversation and tab mode
  useEffect(() => {
    if (!user) return;
    
    // Clear messages when starting new conversation
    if (!conversationId) {
      setMessages([]);
      return;
    }

    // Check if the conversation type matches the current tab
    const expectedConversationType = activeTab === 'photo' ? 'image' : 'text';
    const conversationPrefix = conversationId.split('_')[0];
    
    // If conversation type doesn't match current tab, clear messages and start new conversation
    if ((expectedConversationType === 'image' && conversationPrefix !== 'image') ||
        (expectedConversationType === 'text' && conversationPrefix !== 'text')) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('userId', '==', user.uid),
      where('conversationId', '==', conversationId)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const newMessages: Message[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const messageData = {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date()
          } as Message;
          
          // Handle local storage references for generated images
          if (messageData.generatedImage && messageData.generatedImage.startsWith('local:')) {
            const imageKey = messageData.generatedImage.replace('local:', '');
            const storedImage = localStorage.getItem(imageKey);
            if (storedImage) {
              messageData.generatedImage = storedImage;
            }
          }
          
          newMessages.push(messageData);
        });
        newMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setMessages(newMessages);
      },
      (error) => {
        console.error('Error loading messages:', error);
        // Fallback to simple query without ordering
        const fallbackQ = query(
          collection(db, 'messages'),
          where('userId', '==', user.uid),
          where('conversationId', '==', conversationId)
        );
        onSnapshot(fallbackQ, (snapshot) => {
          const newMessages: Message[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const messageData = {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date()
            } as Message;
            
            // Handle local storage references for generated images
            if (messageData.generatedImage && messageData.generatedImage.startsWith('local:')) {
              const imageKey = messageData.generatedImage.replace('local:', '');
              const storedImage = localStorage.getItem(imageKey);
              if (storedImage) {
                messageData.generatedImage = storedImage;
              }
            }
            
            newMessages.push(messageData);
          });
          newMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setMessages(newMessages);
        });
      }
    );

    return () => unsubscribe();
  }, [user, conversationId, activeTab]);

  // Finalize conversation when switching conversations or unmounting
  useEffect(() => {
    const finalizeCurrentConversation = async () => {
      if (!user || !conversationId || messages.length === 0) return;
      
      try {
        const memoryMessages: MemoryMessage[] = messages.map(msg => ({
          id: msg.id,
          conversationId: conversationId,
          userId: user.uid,
          content: msg.text || (msg.generatedImage ? 'Generated image' : ''),
          role: msg.isUser ? 'user' : 'assistant',
          timestamp: new Date(msg.timestamp),
          metadata: {
            hasImages: (msg.images?.length || 0) > 0,
            imageUrls: msg.images,
            isImageGeneration: !!msg.generatedImage,
            imageUrl: msg.generatedImage
          }
        }));

        const conversationMetadata: ConversationMetadata = {
          conversationId: conversationId,
          userId: user.uid,
          title: messages[0]?.text?.length > 50 
            ? messages[0].text.substring(0, 50) + '...' 
            : messages[0]?.text || 'Untitled Conversation',
          messageCount: messages.length,
          lastActivity: new Date(),
          tags: [activeTab, messages.some(m => m.generatedImage) ? 'image-generation' : 'text-chat'],
          satisfactionRating: undefined
        };

        await memoryService.finalizeConversation(
          conversationId,
          user.uid,
          memoryMessages,
          conversationMetadata
        );
      } catch (error) {
        console.warn('Failed to finalize conversation:', error);
      }
    };

    // Cleanup function to finalize conversation
    return () => {
      if (conversationId && messages.length > 0) {
        finalizeCurrentConversation();
      }
    };
  }, [conversationId, user, messages.length]); // Only run when conversation changes

  // Handle tab switching - clear incompatible conversations
  useEffect(() => {
    if (!conversationId) return;
    
    const expectedConversationType = activeTab === 'photo' ? 'image' : 'text';
    const conversationPrefix = conversationId.split('_')[0];
    
    // If conversation type doesn't match current tab, we should start fresh
    if ((expectedConversationType === 'image' && conversationPrefix !== 'image') ||
        (expectedConversationType === 'text' && conversationPrefix !== 'text')) {
      // This will trigger the parent component to clear the conversation
      // For now, just clear messages locally
      setMessages([]);
    }
  }, [activeTab, conversationId]);

  const uploadImageToStorage = async (file: File): Promise<string> => {
    const storageRef = ref(storage, `images/${user?.uid}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
  };

  const showUpgradePrompt = (currentPlan: any) => {
    const nextResetTime = new Date();
    nextResetTime.setHours(24, 0, 0, 0); // Next midnight
    const timeUntilReset = Math.ceil((nextResetTime.getTime() - Date.now()) / (1000 * 60 * 60)); // Hours until reset
    
    toast((t) => (
      <div className="flex flex-col gap-3 p-2">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-[#00D4FF]" />
          <span className="font-semibold text-white">Daily Limit Reached</span>
        </div>
        <p className="text-gray-300 text-sm">
          You've used all {currentPlan.dailyLimit} generations for today on the {currentPlan.displayName} plan.
        </p>
        <p className="text-gray-400 text-xs">
          Your usage resets in {timeUntilReset} hour{timeUntilReset !== 1 ? 's' : ''} (midnight ET).
        </p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              window.open('/pricing', '_blank');
              toast.dismiss(t.id);
            }}
            className="px-3 py-1.5 text-xs pixtor-gradient text-white rounded-md pixtor-gradient-hover transition-all duration-300 pixtor-glow"
          >
            Upgrade Plan
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
          >
            Wait for Reset
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      position: 'top-center',
      style: {
        background: '#1f2937',
        color: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #374151',
        maxWidth: '400px',
      },
    });
  };

  const handleSend = async () => {
    if (!input.trim() && uploadedImages.length === 0) return;
    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    const userMessage = input.trim();
    const images = [...uploadedImages];
    
    // Create conversation type based on current tab and whether images are uploaded
    const conversationType: 'text' | 'image' = activeTab === 'photo' || images.length > 0 ? 'image' : 'text';
    
    // Generate conversation ID with type prefix for better organization
    const currentConvId = conversationId || `${conversationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Clear input immediately
    setInput('');
    setUploadedImages([]);
    setAutoAddedImages([]);
    setIsGenerating(true);

    // Add user message immediately to UI
    const tempId = `temp_${Date.now()}`;
    const userMsg: Message = {
      id: tempId,
      text: userMessage,
      isUser: true,
      timestamp: new Date(),
    };

    if (images.length > 0) {
      userMsg.images = images.map(img => URL.createObjectURL(img));
    }

    setMessages(prev => [...prev, userMsg]);

    // Add loading message with original images for blur effect
    const loadingId = `loading_${Date.now()}`;
    const loadingMsg: Message = {
      id: loadingId,
      isUser: false,
      timestamp: new Date(),
      isLoading: true,
      images: images.length > 0 ? images.map(img => URL.createObjectURL(img)) : undefined,
    };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      // Upload images to storage
      const uploadedUrls: string[] = [];
      for (const image of images) {
        const url = await uploadImageToStorage(image);
        uploadedUrls.push(url);
      }

      // Save user message to database
      await addDoc(collection(db, 'messages'), {
        userId: user.uid,
        conversationId: currentConvId,
        conversationType: conversationType,
        text: userMessage,
        images: uploadedUrls,
        isUser: true,
        timestamp: serverTimestamp(),
      });

      // Check usage limits before making API call
      try {
        const token = await user.getIdToken();
        const usageResponse = await fetch('/api/subscription/usage', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          if (usageData.today.remaining <= 0) {
            // User has exceeded daily limit
            setIsGenerating(false);
            setMessages(prev => prev.filter(msg => msg.id !== loadingId));
            
            toast.error('Daily usage limit exceeded!', {
              duration: 6000,
              position: 'top-center',
              style: {
                background: '#1f2937',
                color: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #374151',
              },
            });
            
            // Show upgrade prompt
            showUpgradePrompt(usageData.plan);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to check usage limits, proceeding with request:', error);
      }

      // Call API - use JSON for text-only, FormData for file uploads
      let requestBody: FormData | string;
      let requestHeaders: HeadersInit = {};

      if (images.length > 0) {
        // Use FormData for file uploads
        const formData = new FormData();
        if (userMessage) formData.append('prompt', userMessage);
        formData.append('mode', activeTab);
        images.forEach((image, index) => {
          formData.append(`image_${index}`, image);
        });
        requestBody = formData;
        // Let browser set Content-Type for FormData
      } else {
        // Use JSON for text-only requests with memory context
        let memoryContext = null;
        
        if (activeTab === 'chat' && user && conversationId) {
          try {
            // Generate comprehensive conversation context using memory management
            memoryContext = await memoryService.generateConversationContext(
              conversationId,
              user.uid,
              userMessage,
              8000 // Max tokens for context
            );
            
            console.log('Generated memory context with', memoryContext.totalTokenCount, 'tokens');
          } catch (error) {
            console.warn('Failed to generate memory context, falling back to basic history:', error);
            
            // Fallback to basic conversation history
            memoryContext = {
              shortTermMemory: {
                messages: messages
                  .filter(msg => !msg.isLoading)
                  .map(msg => ({
                    id: msg.id,
                    content: msg.text || '',
                    role: msg.isUser ? 'user' : 'assistant',
                    timestamp: new Date(msg.timestamp)
                  }))
              },
              relevantSemanticMemories: [],
              relevantEpisodicMemories: [],
              recommendedModel: 'gemini-2.0-flash-exp'
            };
          }
        }
        
        requestBody = JSON.stringify({
          prompt: userMessage || '',
          mode: activeTab,
          memoryContext: memoryContext,
          // Keep legacy support for backward compatibility
          conversationHistory: memoryContext?.shortTermMemory?.messages?.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content || '' }]
          })) || []
        });
        requestHeaders = {
          'Content-Type': 'application/json'
        };
      }

      // Add authentication header
      const token = await user.getIdToken();
      requestHeaders = {
        ...requestHeaders,
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch('/api/generate-image-v2', {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
      });

      // Check if we got HTML instead of JSON (API route not working)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Got non-JSON response from API, response:', response.status, response.statusText);
        const responseText = await response.text();
        console.warn('Response body:', responseText.substring(0, 500));
        throw new Error(`API endpoint returned ${response.status}: ${response.statusText}. Check Firebase Functions deployment.`);
      }

      const result = await response.json();
      
      if (!response.ok) {
        // Handle usage limit errors specifically
        if (response.status === 429 && result.errorType === 'USAGE_LIMIT_EXCEEDED') {
          setIsGenerating(false);
          // Remove loading message
          setMessages(prev => prev.filter(msg => msg.id !== loadingId));
          
          toast.error('Daily usage limit exceeded!', {
            duration: 6000,
            position: 'top-center',
            style: {
              background: '#1f2937',
              color: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #374151',
            },
          });
          
          showUpgradePrompt(result.plan);
          return;
        }
        
        // Handle feature gate errors
        if (response.status === 403 && result.errorType === 'FEATURE_GATE_BLOCKED') {
          setIsGenerating(false);
          setMessages(prev => prev.filter(msg => msg.id !== loadingId));
          
          toast.error(result.error || 'Feature not available in current plan', {
            duration: 6000,
            position: 'top-center',
          });
          
          if (result.suggestedPlan) {
            showUpgradePrompt({ displayName: result.suggestedPlan.displayName, dailyLimit: result.suggestedPlan.dailyLimit });
          }
          return;
        }
        
        // Throw error with response data for other errors
        const error: any = new Error(result.error || 'Failed to process request');
        error.response = { data: result };
        throw error;
      }

      // Save AI response to database
      const aiMessageData: any = {
        userId: user.uid,
        conversationId: currentConvId,
        conversationType: conversationType,
        isUser: false,
        timestamp: serverTimestamp(),
        modelUsed: result.modelUsed,
      };

      if (result.isImageGeneration) {
        // Don't save data URLs to Firestore (too large)
        // Instead, save a placeholder or external URL
        if (result.imageUrl.startsWith('data:')) {
          try {
            // For data URLs, we'll store them in browser's local storage or session
            const imageKey = `generated_${currentConvId}_${Date.now()}`;
            
            // Clean up old entries first to free space
            cleanupOldStorageEntries();
            
            // Try to compress and store the image
            const compressedImage = await compressImageForStorage(result.imageUrl);
            localStorage.setItem(imageKey, compressedImage);
            aiMessageData.generatedImage = `local:${imageKey}`;
          } catch (storageError) {
            console.warn('Failed to store image in localStorage:', storageError);
            // Fallback: just reference the external URL or use a placeholder
            aiMessageData.generatedImage = result.imageUrl.startsWith('http') 
              ? result.imageUrl 
              : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjNEI1NTYzIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTUwIiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCI+SW1hZ2UgTm90IEF2YWlsYWJsZTwvdGV4dD4KPC9zdmc+';
          }
        } else {
          // For external URLs, save them directly
          aiMessageData.generatedImage = result.imageUrl;
        }
        // Store original uploaded images for context
        if (images.length > 0) {
          aiMessageData.originalImages = uploadedUrls;
        }
        // Don't save reasoning text, just the image
      } else {
        aiMessageData.text = result.text;
      }

      await addDoc(collection(db, 'messages'), aiMessageData);

      // Process messages through memory management system
      try {
        if (user) {
          // Create memory messages from the conversation
          const userMemoryMessage: MemoryMessage = {
            id: tempId,
            conversationId: currentConvId,
            userId: user.uid,
            content: userMessage,
            role: 'user',
            timestamp: new Date(),
            metadata: {
              hasImages: images.length > 0,
              imageUrls: uploadedUrls
            }
          };
          
          const aiMemoryMessage: MemoryMessage = {
            id: `ai_${Date.now()}`,
            conversationId: currentConvId,
            userId: user.uid,
            content: result.text || 'Generated image',
            role: 'assistant',
            timestamp: new Date(),
            metadata: {
              isImageGeneration: result.isImageGeneration,
              imageUrl: result.isImageGeneration ? result.imageUrl : undefined,
              modelUsed: result.modelUsed
            }
          };

          const conversationMetadata: ConversationMetadata = {
            conversationId: currentConvId,
            userId: user.uid,
            title: userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage,
            messageCount: messages.length + 2, // +2 for user and AI messages
            lastActivity: new Date(),
            tags: [conversationType, activeTab],
            satisfactionRating: undefined // Will be set later if user provides feedback
          };

          // Process both messages through memory system
          await memoryService.processMessage(userMemoryMessage, conversationMetadata);
          await memoryService.processMessage(aiMemoryMessage, conversationMetadata);
        }
      } catch (memoryError) {
        console.warn('Failed to process messages through memory system:', memoryError);
        // Continue with UI updates even if memory processing fails
      }

      // Transform loading message to show result with morphing animation
      let displayImageUrl = undefined;
      if (result.isImageGeneration && aiMessageData.generatedImage) {
        // Handle localStorage references
        if (aiMessageData.generatedImage.startsWith('local:')) {
          const imageKey = aiMessageData.generatedImage.replace('local:', '');
          const storedImage = localStorage.getItem(imageKey);
          displayImageUrl = storedImage || result.imageUrl; // Fallback to original URL
        } else {
          displayImageUrl = aiMessageData.generatedImage;
        }
      }
      
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMsg.id 
          ? {
              ...msg,
              isLoading: false,
              generatedImage: displayImageUrl,
              originalImages: result.isImageGeneration && images.length > 0 ? uploadedUrls : undefined,
              text: result.isImageGeneration ? undefined : result.text
            }
          : msg
      ));

      // Auto-add generated image to next message context if it's an image generation
      if (result.isImageGeneration && result.imageUrl) {
        try {
          const response = await fetch(result.imageUrl);
          const blob = await response.blob();
          const fileName = `auto_generated_${Date.now()}.png`;
          const file = new File([blob], fileName, { type: blob.type || 'image/png' });
          
          setAutoAddedImages(prev => [...prev, {url: result.imageUrl, id: `auto_${Date.now()}`}]);
          setUploadedImages(prev => [...prev, file]);
          setActiveTab('photo'); // Switch to photo editing mode
          
          toast.success('✨ Generated image added to next message for continued editing!', {
            duration: 3000,
            icon: '🎨'
          });
        } catch (error) {
          console.error('Failed to auto-add generated image:', error);
        }
      }

    } catch (error: any) {
      console.error('Error:', error);
      
      // Check if it's a content violation error
      if (error.response?.data?.errorType === 'CONTENT_VIOLATION') {
        toast.error('⚠️ ' + (error.response.data.error || 'Content guidelines violation'));
      } else if (error.response?.data?.errorType === 'SAFETY_VIOLATION') {
        toast.error('🔒 ' + (error.response.data.error || 'Safety violation detected'));
      } else if (error.response?.data?.errorType === 'PROCESSING_ERROR') {
        toast.error('❌ ' + (error.response.data.error || 'Unable to process request'));
      } else {
        toast.error(error.message || 'Failed to send message');
      }
      
      // Remove temp and loading messages on error
      setMessages(prev => prev.filter(msg => 
        msg.id !== tempId && msg.id !== loadingMsg.id
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const selectedFiles = Array.from(files);
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Please select image files only');
      return;
    }
    
    if (uploadedImages.length + imageFiles.length > 2) {
      toast.error('Maximum 2 images allowed');
      return;
    }
    
    setUploadedImages(prev => [...prev, ...imageFiles]);
    setActiveTab('photo'); // Switch to photo editing mode when images are uploaded
    toast.success(`${imageFiles.length} image(s) added`);
  };

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);
    
    // Also remove from auto-added list if it was auto-added
    setAutoAddedImages(prev => prev.filter((_, i) => i !== index));
    
    // Switch back to chat mode if all images are removed
    if (newImages.length === 0 && activeTab === 'photo') {
      setActiveTab('chat');
    }
  };

  // Utility function to compress images for localStorage
  const compressImageForStorage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Reduce size for storage (max 500px width/height)
        const maxSize = 500;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with quality 0.7 for smaller file size
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl);
      };
      img.src = dataUrl;
    });
  };

  // Cleanup old localStorage entries to free space
  const cleanupOldStorageEntries = () => {
    try {
      const keys = Object.keys(localStorage);
      const imageKeys = keys.filter(key => key.startsWith('generated_'));
      
      // Keep only the last 20 images (arbitrary limit)
      if (imageKeys.length > 20) {
        const sortedKeys = imageKeys.sort((a, b) => {
          const timestampA = parseInt(a.split('_')[2] || '0');
          const timestampB = parseInt(b.split('_')[2] || '0');
          return timestampA - timestampB;
        });
        
        // Remove oldest entries
        const keysToRemove = sortedKeys.slice(0, imageKeys.length - 20);
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.warn('Failed to remove old storage entry:', key);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to cleanup old storage entries:', error);
    }
  };

  const toggleOriginals = (messageId: string) => {
    setShowOriginals(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const addImageToUpload = async (imageUrl: string) => {
    if (uploadedImages.length >= 2) {
      toast.error('Maximum 2 images allowed');
      return;
    }

    try {
      // Convert URL to File object
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Create a unique filename
      const fileName = `image_${Date.now()}.png`;
      const file = new File([blob], fileName, { type: blob.type || 'image/png' });
      
      setUploadedImages(prev => [...prev, file]);
      toast.success('Image added for editing');
    } catch (error) {
      console.error('Error adding image:', error);
      toast.error('Failed to add image');
    }
  };

  const addBananaToImage = async (imageUrl: string) => {
    try {
      // Add the image to upload first
      await addImageToUpload(imageUrl);
      
      // Set a fun banana prompt
      const bananaPrompts = [
        "Add a giant yellow banana floating in the sky above this scene",
        "Place a fun cartoon banana character dancing in this image", 
        "Add a bunch of bananas hanging from a tree branch in this photo",
        "Put a cool banana wearing sunglasses somewhere in this scene",
        "Add a magical glowing banana as the centerpiece of this image",
        "Place a banana boat sailing through this scene",
        "Add a banana rainbow arcing across this image"
      ];
      
      const randomPrompt = bananaPrompts[Math.floor(Math.random() * bananaPrompts.length)];
      setInput(randomPrompt);
      
      toast.success('🍌 Banana prompt ready! Click send to add the banana magic!');
    } catch (error) {
      console.error('Error adding banana:', error);
      toast.error('Failed to prepare banana magic');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Image downloaded successfully');
    } catch (error) {
      toast.error('Failed to download image');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Tabs */}
      <div className="border-b border-gray-800 bg-gray-900 bg-opacity-50">
        <div className="px-2 sm:px-4 py-3">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                <MessageSquare size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Text Chat</span>
                <span className="xs:hidden">Chat</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('photo')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                activeTab === 'photo'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                <ImageIcon size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Photo Editing</span>
                <span className="xs:hidden">Photo</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-6 rounded-full mb-6">
              {activeTab === 'chat' ? (
                <MessageSquare className="w-12 h-12 text-white" />
              ) : (
                <ImageIcon className="w-12 h-12 text-white" />
              )}
            </div>
            <h3 className="text-lg sm:text-2xl font-bold text-white mb-3">
              {activeTab === 'chat' ? 'Start a Conversation' : 'Edit Your Photos'}
            </h3>
            <p className="text-sm sm:text-base text-gray-400 max-w-md leading-relaxed px-4 sm:px-0">
              {activeTab === 'chat' 
                ? 'Ask me anything or describe an image you want to create. I can help with questions, creative ideas, and more!'
                : 'Upload up to 2 images and tell me how you want them edited. I can enhance, modify, transform, or completely reimagine your photos!'}
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex gap-4 ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar */}
              {!message.isUser && (
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              )}

              {/* Message Content */}
              <div className={`max-w-full sm:max-w-2xl ${message.isUser ? 'order-first' : ''}`}>
                <div className={`rounded-2xl p-3 sm:p-4 ${
                  message.isUser 
                    ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white ml-auto' 
                    : 'bg-gray-800 text-white'
                }`}>
                  {message.isLoading ? (
                    <div className="space-y-4">
                      {message.images && message.images.length > 0 ? (
                        <>
                          <div className="relative">
                            <div className="grid grid-cols-2 gap-2">
                              {message.images.map((img, index) => (
                                <div key={index} className="relative overflow-hidden rounded-lg">
                                  <img
                                    src={img}
                                    alt="Processing"
                                    className="w-full h-auto animate-pulse pixelated-loading"
                                    style={{
                                      filter: 'brightness(0.8) contrast(1.2)',
                                      imageRendering: 'pixelated',
                                      transform: 'scale(0.1)',
                                      transformOrigin: 'center',
                                      animation: 'pixelate-pulse 2s ease-in-out infinite'
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-purple-600 bg-opacity-20 animate-pulse"></div>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-black bg-opacity-50 rounded-full p-3">
                                      <Sparkles className="w-6 h-6 text-purple-400 animate-spin" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                            <span className="text-gray-300">Generating your image...</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span className="text-gray-300">AI is creating...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {message.text && (
                        message.isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                        ) : (
                          <div className="prose prose-invert prose-lg max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                // Enhanced headers with gradient colors and better spacing
                                h1: ({children}) => (
                                  <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4 mt-6 first:mt-0">
                                    {children}
                                  </h1>
                                ),
                                h2: ({children}) => (
                                  <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-3 mt-5 first:mt-0">
                                    {children}
                                  </h2>
                                ),
                                h3: ({children}) => (
                                  <h3 className="text-lg font-semibold text-white mb-2 mt-4 first:mt-0">
                                    {children}
                                  </h3>
                                ),
                                h4: ({children}) => (
                                  <h4 className="text-base font-semibold text-gray-100 mb-2 mt-3">
                                    {children}
                                  </h4>
                                ),
                                
                                // Enhanced paragraph styling
                                p: ({children}) => (
                                  <p className="text-gray-200 mb-4 leading-relaxed text-base">
                                    {children}
                                  </p>
                                ),
                                
                                // Rich list styling with custom bullets and better spacing
                                ul: ({children}) => (
                                  <ul className="mb-4 space-y-2 pl-6">
                                    {children}
                                  </ul>
                                ),
                                ol: ({children}) => (
                                  <ol className="mb-4 space-y-2 pl-6 list-decimal">
                                    {children}
                                  </ol>
                                ),
                                li: ({children}) => (
                                  <li className="text-gray-200 relative pl-2">
                                    <span className="absolute -left-6 top-0 text-cyan-400 font-bold">•</span>
                                    {children}
                                  </li>
                                ),
                                
                                // Enhanced text formatting
                                strong: ({children}) => (
                                  <strong className="font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                                    {children}
                                  </strong>
                                ),
                                em: ({children}) => (
                                  <em className="italic text-blue-300 font-medium">
                                    {children}
                                  </em>
                                ),
                                
                                // Enhanced code styling
                                code: ({children}) => (
                                  <code className="bg-gradient-to-r from-gray-800 to-gray-700 px-2 py-1 rounded-md text-sm font-mono text-emerald-400 border border-gray-600">
                                    {children}
                                  </code>
                                ),
                                pre: ({children}) => (
                                  <pre className="bg-gradient-to-br from-gray-800 via-gray-900 to-black p-4 rounded-xl overflow-x-auto text-sm font-mono border border-gray-700 shadow-lg mb-4">
                                    {children}
                                  </pre>
                                ),
                                
                                // Enhanced blockquote with rich styling
                                blockquote: ({children}) => (
                                  <blockquote className="border-l-4 border-gradient-to-b from-purple-500 to-pink-500 bg-gradient-to-r from-purple-900/20 to-pink-900/20 pl-6 pr-4 py-3 my-4 italic text-gray-300 rounded-r-lg backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                      <div className="text-purple-400 text-xl mt-1">"</div>
                                      <div className="flex-1">{children}</div>
                                    </div>
                                  </blockquote>
                                ),
                                
                                // Enhanced links (if any)
                                a: ({children, href}) => (
                                  <a 
                                    href={href}
                                    className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/50 hover:decoration-blue-300 transition-colors duration-200"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {children}
                                  </a>
                                ),
                                
                                // Enhanced tables (if any)
                                table: ({children}) => (
                                  <div className="overflow-x-auto mb-4">
                                    <table className="min-w-full border border-gray-700 rounded-lg">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({children}) => (
                                  <thead className="bg-gradient-to-r from-gray-800 to-gray-700">
                                    {children}
                                  </thead>
                                ),
                                th: ({children}) => (
                                  <th className="px-4 py-2 text-left font-semibold text-white border-b border-gray-600">
                                    {children}
                                  </th>
                                ),
                                td: ({children}) => (
                                  <td className="px-4 py-2 text-gray-200 border-b border-gray-700">
                                    {children}
                                  </td>
                                ),
                                
                                // Enhanced horizontal rules
                                hr: () => (
                                  <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent" />
                                )
                              }}
                            >
                              {message.text}
                            </ReactMarkdown>
                          </div>
                        )
                      )}
                      
                      {/* Only show original images for user messages (not AI responses with generated images) */}
                      {message.images && message.images.length > 0 && !message.generatedImage && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {message.images.map((img, index) => (
                            <img
                              key={index}
                              src={img}
                              alt="Uploaded"
                              className="rounded-lg max-w-full"
                            />
                          ))}
                        </div>
                      )}

                      {message.generatedImage && (
                        <div className="mt-3">
                          {/* Generated Result */}
                          <div className="relative group">
                            <img
                              src={message.generatedImage}
                              alt="Generated"
                              className="rounded-lg max-w-full morph-to-result"
                            />
                            <div className="absolute top-2 right-2 flex gap-2">
                              {/* Toggle original images button */}
                              {message.originalImages && message.originalImages.length > 0 && (
                                <button
                                  onClick={() => toggleOriginals(message.id)}
                                  className="p-2 bg-gray-700 bg-opacity-80 hover:bg-gray-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                  title={showOriginals[message.id] ? "Hide original images" : "Show original images"}
                                >
                                  {showOriginals[message.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              )}
                              <button
                                onClick={() => addImageToUpload(message.generatedImage!)}
                                className="p-2 bg-blue-500 bg-opacity-80 hover:bg-blue-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                title="Use this image for editing"
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                onClick={() => addBananaToImage(message.generatedImage!)}
                                className="p-2 bg-yellow-500 bg-opacity-80 hover:bg-yellow-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                title="Add a fun banana to this image! 🍌"
                              >
                                🍌
                              </button>
                              <button
                                onClick={() => handleDownload(message.generatedImage!)}
                                className="p-2 bg-black bg-opacity-50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Download size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                      )}

                      {/* Collapsible Original Images */}
                      {message.originalImages && message.originalImages.length > 0 && showOriginals[message.id] && (
                        <div className="mt-3 p-3 bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Eye size={14} className="text-gray-400" />
                            <p className="text-gray-400 text-sm">Original Images:</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {message.originalImages.map((img, index) => (
                              <div key={`orig-${index}`} className="relative group">
                                <img
                                  src={img}
                                  alt={`Original ${index + 1}`}
                                  className="rounded-lg max-w-full opacity-80"
                                />
                                <div className="absolute top-2 right-2 flex gap-1">
                                  <button
                                    onClick={() => addImageToUpload(img)}
                                    className="p-1 bg-blue-500 bg-opacity-80 hover:bg-blue-500 text-white rounded opacity-0 group-hover:opacity-100 transition-all"
                                    title="Use this image for editing"
                                  >
                                    <Plus size={12} />
                                  </button>
                                  <button
                                    onClick={() => addBananaToImage(img)}
                                    className="p-1 bg-yellow-500 bg-opacity-80 hover:bg-yellow-500 text-white rounded opacity-0 group-hover:opacity-100 transition-all text-xs"
                                    title="Add a fun banana to this image! 🍌"
                                  >
                                    🍌
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* User Avatar */}
              {message.isUser && (
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-800 bg-gray-900 bg-opacity-50 backdrop-blur-sm">
        {/* AI Model Indicator */}
        <div className="px-2 sm:px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="hidden sm:inline">Active Model: </span>
              <span className="sm:hidden">Model: </span>
              <span className="text-white font-medium text-xs truncate">
                {activeTab === 'photo' || uploadedImages.length > 0 || input.trim().toLowerCase().split(' ').some(word => 
                  ['generate', 'create', 'make', 'draw', 'design', 'produce', 'image', 'picture', 'photo', 'illustration', 'artwork', 'edit', 'modify', 'enhance', 'transform', 'change', 'add', 'remove'].includes(word)
                ) 
                  ? 'Gemini 2.5 Flash Image Preview'
                  : 'Gemini 2.0 Flash (Chat)'}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {uploadedImages.length > 0 ? `${uploadedImages.length}/2 images` : 'Text mode'}
            </div>
          </div>
        </div>
        {/* Image Preview */}
        {uploadedImages.length > 0 && (
          <div className="px-2 sm:px-4 pt-4">
            <div className="flex gap-2 pb-2">
              {uploadedImages.map((file, index) => {
                const isAutoAdded = autoAddedImages.some((_, i) => i === index);
                return (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Preview"
                      className={`w-16 h-16 object-cover rounded-lg border-2 ${
                        isAutoAdded 
                          ? 'border-purple-400 ring-2 ring-purple-300 ring-opacity-50' 
                          : 'border-gray-700'
                      }`}
                    />
                    {isAutoAdded && (
                      <div className="absolute -top-2 -left-2 w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        ✨
                      </div>
                    )}
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title={isAutoAdded ? 'Remove auto-added image' : 'Remove image'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
            {autoAddedImages.length > 0 && (
              <div className="pb-2">
                <div className="flex items-center gap-2 text-xs text-purple-400">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                  <span>✨ Auto-added from previous generation - remove if not needed</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Box */}
        <div className="px-2 sm:px-4 pb-4 pt-2">
          <div
            className={`relative bg-gray-800 rounded-2xl border-2 transition-all ${
              dragActive 
                ? 'border-purple-500 bg-purple-500 bg-opacity-10' 
                : 'border-gray-700 hover:border-gray-600 focus-within:border-purple-500'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
          >
            <div className="flex items-end gap-2 p-2 sm:p-3">
              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                title="Upload images"
              >
                <ImageIcon size={18} className="sm:w-5 sm:h-5" />
              </button>

              {/* Text Input */}
              <textarea
                ref={textareaRef}
                data-testid="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={dragActive ? "Drop images here..." : "Type a message or ask me to create something amazing..."}
                className="flex-1 bg-transparent text-white placeholder-gray-400 resize-none outline-none max-h-32 min-h-[20px] py-2 text-sm sm:text-base"
                rows={1}
                disabled={isGenerating}
              />

              {/* Send Button */}
              <button
                data-testid="send-button"
                onClick={handleSend}
                disabled={isGenerating || (!input.trim() && uploadedImages.length === 0)}
                className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isGenerating ? (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={18} className="sm:w-5 sm:h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
    </div>
  );
}