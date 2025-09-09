// Short-term Memory Service (10-12 turn rolling window)
// Maintains recent conversation context across model switches

import { collection, doc, setDoc, getDoc, query, where, orderBy, limit, onSnapshot, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShortTermMemory, ShortTermMessage, Message, MemorySettings } from '@/lib/types/memory';

export class ShortTermMemoryService {
  private static instance: ShortTermMemoryService;
  private readonly DEFAULT_WINDOW_SIZE = 12;
  private readonly IMPORTANCE_DECAY_FACTOR = 0.9; // Importance decreases over time
  private memoryCache: Map<string, ShortTermMemory> = new Map();

  private constructor() {}

  public static getInstance(): ShortTermMemoryService {
    if (!ShortTermMemoryService.instance) {
      ShortTermMemoryService.instance = new ShortTermMemoryService();
    }
    return ShortTermMemoryService.instance;
  }

  /**
   * Add a new message to short-term memory with automatic window management
   */
  public async addMessage(
    conversationId: string, 
    userId: string, 
    message: Message,
    memorySettings?: MemorySettings
  ): Promise<void> {
    try {
      if (!memorySettings?.shortTermMemoryEnabled) {
        console.log('Short-term memory disabled for user:', userId);
        return;
      }

      // Get or create short-term memory
      let memory = await this.getShortTermMemory(conversationId, userId);
      
      if (!memory) {
        memory = {
          id: `stm_${conversationId}`,
          conversationId,
          userId,
          messages: [],
          windowSize: memorySettings?.maxSemanticMemories || this.DEFAULT_WINDOW_SIZE,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      // Calculate message importance
      const importance = this.calculateMessageImportance(message, memory.messages);

      // Create short-term message
      const shortTermMessage: ShortTermMessage = {
        messageId: message.id,
        content: message.content,
        role: message.role,
        modelProvider: message.modelProvider,
        timestamp: message.timestamp,
        importance
      };

      // Add message to memory
      memory.messages.push(shortTermMessage);

      // Apply sliding window with importance-based retention
      memory.messages = this.applyRetentionStrategy(memory.messages, memory.windowSize);

      // Update timestamps
      memory.updatedAt = new Date();

      // Save to database
      await this.saveShortTermMemory(memory);

      // Update cache
      this.memoryCache.set(conversationId, memory);

      console.log(`Added message to short-term memory: ${conversationId}, window size: ${memory.messages.length}`);
      
    } catch (error) {
      console.error('Error adding message to short-term memory:', error);
      throw error;
    }
  }

  /**
   * Retrieve short-term memory for a conversation
   */
  public async getShortTermMemory(conversationId: string, userId: string): Promise<ShortTermMemory | null> {
    try {
      // Check cache first
      if (this.memoryCache.has(conversationId)) {
        return this.memoryCache.get(conversationId)!;
      }

      // Fetch from database
      const memoryRef = doc(db, 'shortTermMemories', `stm_${conversationId}`);
      const memorySnap = await getDoc(memoryRef);

      if (!memorySnap.exists()) {
        return null;
      }

      const data = memorySnap.data();
      const memory: ShortTermMemory = {
        id: memorySnap.id,
        conversationId: data.conversationId,
        userId: data.userId,
        messages: data.messages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp?.toDate() || new Date()
        })),
        windowSize: data.windowSize,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      };

      // Update cache
      this.memoryCache.set(conversationId, memory);

      return memory;
      
    } catch (error) {
      console.error('Error retrieving short-term memory:', error);
      return null;
    }
  }

  /**
   * Get formatted conversation context for model input
   */
  public async getConversationContext(
    conversationId: string, 
    userId: string,
    maxTokens: number = 4000
  ): Promise<{ messages: any[], tokenCount: number }> {
    try {
      const memory = await this.getShortTermMemory(conversationId, userId);
      
      if (!memory || memory.messages.length === 0) {
        return { messages: [], tokenCount: 0 };
      }

      // Sort messages by timestamp and importance
      const sortedMessages = memory.messages
        .sort((a, b) => {
          // Primary sort: timestamp (chronological)
          const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
          if (timeDiff !== 0) return timeDiff;
          
          // Secondary sort: importance (higher first)
          return b.importance - a.importance;
        });

      // Format for model consumption and respect token limits
      const formattedMessages: any[] = [];
      let tokenCount = 0;

      for (const msg of sortedMessages) {
        // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
        const msgTokens = Math.ceil(msg.content.length / 4);
        
        if (tokenCount + msgTokens > maxTokens) {
          break; // Stop if we would exceed token limit
        }

        formattedMessages.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
          metadata: {
            timestamp: msg.timestamp,
            importance: msg.importance,
            modelProvider: msg.modelProvider,
            messageId: msg.messageId
          }
        });

        tokenCount += msgTokens;
      }

      // Ensure chronological order for context
      formattedMessages.sort((a, b) => 
        a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime()
      );

      return { messages: formattedMessages, tokenCount };
      
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return { messages: [], tokenCount: 0 };
    }
  }

  /**
   * Clear short-term memory for a conversation
   */
  public async clearShortTermMemory(conversationId: string, userId: string): Promise<void> {
    try {
      const memoryRef = doc(db, 'shortTermMemories', `stm_${conversationId}`);
      
      // Create empty memory structure
      const emptyMemory: ShortTermMemory = {
        id: `stm_${conversationId}`,
        conversationId,
        userId,
        messages: [],
        windowSize: this.DEFAULT_WINDOW_SIZE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(memoryRef, {
        ...emptyMemory,
        createdAt: Timestamp.fromDate(emptyMemory.createdAt),
        updatedAt: Timestamp.fromDate(emptyMemory.updatedAt)
      });

      // Update cache
      this.memoryCache.set(conversationId, emptyMemory);
      
      console.log(`Cleared short-term memory for conversation: ${conversationId}`);
      
    } catch (error) {
      console.error('Error clearing short-term memory:', error);
      throw error;
    }
  }

  /**
   * Get recent conversations with short-term memory
   */
  public async getRecentConversations(userId: string, limit_count: number = 10): Promise<ShortTermMemory[]> {
    try {
      const q = query(
        collection(db, 'shortTermMemories'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(limit_count)
      );

      return new Promise((resolve, reject) => {
        onSnapshot(q, (snapshot) => {
          const memories: ShortTermMemory[] = [];
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            memories.push({
              id: doc.id,
              conversationId: data.conversationId,
              userId: data.userId,
              messages: data.messages.map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp?.toDate() || new Date()
              })),
              windowSize: data.windowSize,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date()
            });
          });
          
          resolve(memories);
        }, (error) => {
          console.error('Error getting recent conversations:', error);
          reject(error);
        });
      });
      
    } catch (error) {
      console.error('Error getting recent conversations:', error);
      return [];
    }
  }

  /**
   * Calculate message importance based on various factors
   */
  private calculateMessageImportance(message: Message, existingMessages: ShortTermMessage[]): number {
    let importance = 0.5; // Base importance

    // Content-based factors
    const content = message.content.toLowerCase();
    
    // Question indicators increase importance
    if (content.includes('?') || content.startsWith('what') || content.startsWith('how') || 
        content.startsWith('why') || content.startsWith('when') || content.startsWith('where')) {
      importance += 0.2;
    }

    // Error or correction indicators
    if (content.includes('error') || content.includes('wrong') || content.includes('correct') ||
        content.includes('mistake') || content.includes('fix')) {
      importance += 0.3;
    }

    // Important concepts
    if (content.includes('important') || content.includes('remember') || content.includes('key') ||
        content.includes('crucial') || content.includes('critical')) {
      importance += 0.2;
    }

    // User preferences or personal information
    if (content.includes('i like') || content.includes('i prefer') || content.includes('my name') ||
        content.includes('i am') || content.includes('i need')) {
      importance += 0.3;
    }

    // Length factor (longer messages might be more important)
    if (content.length > 200) {
      importance += 0.1;
    }

    // Recency factor (more recent messages are more important)
    const now = Date.now();
    const messageAge = now - message.timestamp.getTime();
    const ageHours = messageAge / (1000 * 60 * 60);
    
    if (ageHours < 1) {
      importance += 0.2; // Very recent
    } else if (ageHours < 24) {
      importance += 0.1; // Recent
    }

    // Model switch context (if switching models, previous context is important)
    if (existingMessages.length > 0) {
      const lastMessage = existingMessages[existingMessages.length - 1];
      if (lastMessage.modelProvider !== message.modelProvider) {
        importance += 0.15; // Context for model switch
      }
    }

    // Cap importance at 1.0
    return Math.min(importance, 1.0);
  }

  /**
   * Apply retention strategy with sliding window and importance weighting
   */
  private applyRetentionStrategy(messages: ShortTermMessage[], windowSize: number): ShortTermMessage[] {
    if (messages.length <= windowSize) {
      return messages;
    }

    // Sort by importance and recency
    const sortedMessages = messages
      .map(msg => ({
        ...msg,
        adjustedImportance: this.calculateAdjustedImportance(msg)
      }))
      .sort((a, b) => b.adjustedImportance - a.adjustedImportance);

    // Keep the most important messages up to window size
    const retained = sortedMessages.slice(0, windowSize);

    // Sort back to chronological order
    return retained
      .map(({ adjustedImportance, ...msg }) => msg)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Calculate adjusted importance with time decay
   */
  private calculateAdjustedImportance(message: ShortTermMessage): number {
    const now = Date.now();
    const messageAge = now - message.timestamp.getTime();
    const ageHours = messageAge / (1000 * 60 * 60);
    
    // Apply exponential decay
    const decayFactor = Math.pow(this.IMPORTANCE_DECAY_FACTOR, ageHours);
    
    return message.importance * decayFactor;
  }

  /**
   * Save short-term memory to database
   */
  private async saveShortTermMemory(memory: ShortTermMemory): Promise<void> {
    try {
      const memoryRef = doc(db, 'shortTermMemories', memory.id);
      
      await setDoc(memoryRef, {
        conversationId: memory.conversationId,
        userId: memory.userId,
        messages: memory.messages.map(msg => ({
          ...msg,
          timestamp: Timestamp.fromDate(msg.timestamp)
        })),
        windowSize: memory.windowSize,
        createdAt: Timestamp.fromDate(memory.createdAt),
        updatedAt: Timestamp.fromDate(memory.updatedAt)
      });
      
    } catch (error) {
      console.error('Error saving short-term memory:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics for a user
   */
  public async getMemoryStats(userId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageWindowSize: number;
    oldestMemory: Date | null;
    newestMemory: Date | null;
  }> {
    try {
      const q = query(
        collection(db, 'shortTermMemories'),
        where('userId', '==', userId)
      );

      return new Promise((resolve, reject) => {
        onSnapshot(q, (snapshot) => {
          let totalMessages = 0;
          let totalWindowSize = 0;
          let oldestMemory: Date | null = null;
          let newestMemory: Date | null = null;

          snapshot.forEach((doc) => {
            const data = doc.data();
            const memory = {
              messages: data.messages || [],
              windowSize: data.windowSize || 0,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date()
            };

            totalMessages += memory.messages.length;
            totalWindowSize += memory.windowSize;

            if (!oldestMemory || memory.createdAt < oldestMemory) {
              oldestMemory = memory.createdAt;
            }
            if (!newestMemory || memory.updatedAt > newestMemory) {
              newestMemory = memory.updatedAt;
            }
          });

          const totalConversations = snapshot.size;
          const averageWindowSize = totalConversations > 0 ? totalWindowSize / totalConversations : 0;

          resolve({
            totalConversations,
            totalMessages,
            averageWindowSize,
            oldestMemory,
            newestMemory
          });
        }, (error) => {
          console.error('Error getting memory stats:', error);
          reject(error);
        });
      });
      
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return {
        totalConversations: 0,
        totalMessages: 0,
        averageWindowSize: 0,
        oldestMemory: null,
        newestMemory: null
      };
    }
  }

  /**
   * Clean up old memories based on retention settings
   */
  public async cleanupOldMemories(userId: string, retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const q = query(
        collection(db, 'shortTermMemories'),
        where('userId', '==', userId),
        where('updatedAt', '<', Timestamp.fromDate(cutoffDate))
      );

      return new Promise((resolve, reject) => {
        onSnapshot(q, async (snapshot) => {
          try {
            let deletedCount = 0;
            
            for (const docSnap of snapshot.docs) {
              await doc(db, 'shortTermMemories', docSnap.id);
              this.memoryCache.delete(docSnap.data().conversationId);
              deletedCount++;
            }
            
            console.log(`Cleaned up ${deletedCount} old short-term memories for user ${userId}`);
            resolve(deletedCount);
          } catch (error) {
            reject(error);
          }
        }, reject);
      });
      
    } catch (error) {
      console.error('Error cleaning up old memories:', error);
      return 0;
    }
  }
}