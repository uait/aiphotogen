// Central Memory Management Service
// Orchestrates all memory layers for continuous conversation experience

import { collection, doc, setDoc, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ConversationContext, 
  Message, 
  MemorySettings, 
  ConversationMetadata, 
  MemorySearchResult,
  MemoryUsageStats,
  SemanticMemory,
  EpisodicMemory,
  ShortTermMemory 
} from '@/lib/types/memory';
import { ShortTermMemoryService } from './ShortTermMemoryService';
import { SemanticMemoryService } from './SemanticMemoryService';
import { EpisodicMemoryService } from './EpisodicMemoryService';
import { ModelAdapterService } from './ModelAdapterService';

export class MemoryManagementService {
  private static instance: MemoryManagementService;
  private shortTermService: ShortTermMemoryService;
  private semanticService: SemanticMemoryService;
  private episodicService: EpisodicMemoryService;
  private modelAdapter: ModelAdapterService;

  private constructor() {
    this.shortTermService = ShortTermMemoryService.getInstance();
    this.semanticService = SemanticMemoryService.getInstance();
    this.episodicService = EpisodicMemoryService.getInstance();
    this.modelAdapter = ModelAdapterService.getInstance();
  }

  public static getInstance(): MemoryManagementService {
    if (!MemoryManagementService.instance) {
      MemoryManagementService.instance = new MemoryManagementService();
    }
    return MemoryManagementService.instance;
  }

  /**
   * Process a new message and update all memory layers
   */
  public async processMessage(
    message: Message,
    conversationMetadata: ConversationMetadata
  ): Promise<void> {
    try {
      console.log(`Processing message for memory: ${message.id}`);

      // Get user's memory settings
      const memorySettings = await this.getMemorySettings(message.userId);
      
      if (!memorySettings.memoryEnabled) {
        console.log('Memory disabled for user:', message.userId);
        return;
      }

      // Process in parallel for performance
      const promises: Promise<any>[] = [];

      // 1. Add to short-term memory
      if (memorySettings.shortTermMemoryEnabled) {
        promises.push(
          this.shortTermService.addMessage(
            message.conversationId,
            message.userId,
            message,
            memorySettings
          )
        );
      }

      // 2. Create semantic memory for meaningful content
      if (memorySettings.semanticMemoryEnabled && message.role === 'user') {
        promises.push(
          this.semanticService.createMemoryFromMessage(
            message,
            'general',
            this.calculateMessageImportance(message),
            memorySettings
          )
        );
      }

      await Promise.all(promises);

      console.log(`Processed message ${message.id} for all memory layers`);
      
    } catch (error) {
      console.error('Error processing message for memory:', error);
    }
  }

  /**
   * Generate comprehensive conversation context for model input
   */
  public async generateConversationContext(
    conversationId: string,
    userId: string,
    currentPrompt: string,
    maxTokens: number = 8000
  ): Promise<ConversationContext> {
    try {
      console.log(`Generating conversation context for: ${conversationId}`);

      const memorySettings = await this.getMemorySettings(userId);
      
      // Initialize context structure
      const context: ConversationContext = {
        id: `ctx_${conversationId}_${Date.now()}`,
        conversationId,
        userId,
        shortTermMemory: {
          id: '',
          conversationId,
          userId,
          messages: [],
          windowSize: 12,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        relevantSemanticMemories: [],
        relevantEpisodicMemories: [],
        totalTokenCount: 0,
        memoryTokenCount: 0,
        messageTokenCount: 0,
        recommendedModel: this.modelAdapter.getOptimalModel({
          task: currentPrompt,
          complexity: 'medium'
        }),
        createdAt: new Date()
      };

      let remainingTokens = maxTokens;

      // 1. Get short-term memory (highest priority)
      if (memorySettings.shortTermMemoryEnabled) {
        const shortTermContext = await this.shortTermService.getConversationContext(
          conversationId,
          userId,
          Math.floor(remainingTokens * 0.5) // Allocate 50% to short-term
        );
        
        if (shortTermContext.messages.length > 0) {
          const shortTermMemory = await this.shortTermService.getShortTermMemory(conversationId, userId);
          if (shortTermMemory) {
            context.shortTermMemory = shortTermMemory;
          }
          context.messageTokenCount = shortTermContext.tokenCount;
          remainingTokens -= shortTermContext.tokenCount;
        }
      }

      // 2. Get relevant semantic memories
      if (memorySettings.semanticMemoryEnabled && remainingTokens > 0) {
        const semanticTokenAllocation = Math.floor(remainingTokens * 0.6); // 60% of remaining
        const maxSemanticMemories = Math.floor(semanticTokenAllocation / 200); // ~200 tokens per memory
        
        context.relevantSemanticMemories = await this.semanticService.getRelevantMemories(
          userId,
          currentPrompt,
          Math.min(maxSemanticMemories, 10)
        );

        const semanticTokens = this.estimateSemanticMemoryTokens(context.relevantSemanticMemories);
        remainingTokens -= semanticTokens;
      }

      // 3. Get relevant episodic memories (lowest priority but valuable for context)
      if (memorySettings.episodicMemoryEnabled && remainingTokens > 500) {
        const maxEpisodicMemories = Math.floor(remainingTokens / 300); // ~300 tokens per episode
        
        context.relevantEpisodicMemories = await this.episodicService.searchEpisodicMemories(
          userId,
          currentPrompt,
          Math.min(maxEpisodicMemories, 3)
        );

        const episodicTokens = this.estimateEpisodicMemoryTokens(context.relevantEpisodicMemories);
        remainingTokens -= episodicTokens;
      }

      // Calculate final token counts
      context.memoryTokenCount = context.messageTokenCount + 
                                this.estimateSemanticMemoryTokens(context.relevantSemanticMemories) +
                                this.estimateEpisodicMemoryTokens(context.relevantEpisodicMemories);
      
      context.totalTokenCount = context.memoryTokenCount + Math.ceil(currentPrompt.length / 4);

      // Update model recommendation based on context
      context.recommendedModel = this.modelAdapter.getOptimalModel({
        task: currentPrompt,
        hasImages: this.hasImageContent(context),
        complexity: this.determineComplexity(context, currentPrompt)
      }, context);

      console.log(`Generated context with ${context.totalTokenCount} tokens`);
      return context;
      
    } catch (error) {
      console.error('Error generating conversation context:', error);
      // Return minimal context on error
      return {
        id: `ctx_error_${Date.now()}`,
        conversationId,
        userId,
        shortTermMemory: {
          id: '',
          conversationId,
          userId,
          messages: [],
          windowSize: 12,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        relevantSemanticMemories: [],
        relevantEpisodicMemories: [],
        totalTokenCount: 0,
        memoryTokenCount: 0,
        messageTokenCount: 0,
        recommendedModel: this.modelAdapter.getOptimalModel({ task: currentPrompt }),
        createdAt: new Date()
      };
    }
  }

  /**
   * Create episodic memory when conversation ends
   */
  public async finalizeConversation(
    conversationId: string,
    userId: string,
    messages: Message[],
    metadata: ConversationMetadata
  ): Promise<void> {
    try {
      console.log(`Finalizing conversation: ${conversationId}`);

      const memorySettings = await this.getMemorySettings(userId);
      
      if (memorySettings.episodicMemoryEnabled && messages.length >= 5) {
        await this.episodicService.createEpisodicMemory(
          conversationId,
          userId,
          messages,
          metadata,
          memorySettings
        );
      }

      console.log(`Finalized conversation ${conversationId}`);
      
    } catch (error) {
      console.error('Error finalizing conversation:', error);
    }
  }

  /**
   * Search across all memory layers
   */
  public async searchAllMemories(
    userId: string,
    query: string,
    options: {
      includeShortTerm?: boolean;
      includeSemantic?: boolean;
      includeEpisodic?: boolean;
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<MemorySearchResult> {
    const startTime = Date.now();
    
    try {
      const {
        includeShortTerm = true,
        includeSemantic = true,
        includeEpisodic = true,
        limit = 20,
        threshold = 0.6
      } = options;

      const promises: Promise<any>[] = [];

      // Search semantic memories
      if (includeSemantic) {
        promises.push(
          this.semanticService.searchMemories(userId, query, undefined, limit, threshold)
        );
      }

      // Search episodic memories
      if (includeEpisodic) {
        promises.push(
          this.episodicService.searchEpisodicMemories(userId, query, Math.floor(limit / 2), threshold)
        );
      }

      const results = await Promise.all(promises);
      
      const searchResult: MemorySearchResult = {
        memories: {
          semantic: includeSemantic ? results[0]?.memories?.semantic || [] : [],
          episodic: includeEpisodic ? results[includeEpisodic ? 1 : 0] || [] : [],
          shortTerm: [] // Short-term search would require conversation context
        },
        totalCount: 0,
        searchTimeMs: Date.now() - startTime,
        query,
        filters: {}
      };

      searchResult.totalCount = searchResult.memories.semantic.length + 
                               searchResult.memories.episodic.length;

      return searchResult;
      
    } catch (error) {
      console.error('Error searching memories:', error);
      return {
        memories: { semantic: [], episodic: [], shortTerm: [] },
        totalCount: 0,
        searchTimeMs: Date.now() - startTime,
        query,
        filters: {}
      };
    }
  }

  /**
   * Get comprehensive memory usage statistics
   */
  public async getMemoryUsageStats(userId: string): Promise<MemoryUsageStats> {
    try {
      const [semanticStats, episodicStats, shortTermStats] = await Promise.all([
        this.semanticService.getMemoryStats(userId),
        this.episodicService.getEpisodicStats(userId),
        this.shortTermService.getMemoryStats(userId)
      ]);

      // Calculate storage estimates (rough approximations)
      const semanticStorageBytes = semanticStats.totalMemories * 2000; // ~2KB per semantic memory
      const episodicStorageBytes = episodicStats.totalEpisodes * 5000; // ~5KB per episode
      const embeddingStorageBytes = (semanticStats.totalMemories + episodicStats.totalEpisodes) * 3072; // 768 floats * 4 bytes

      return {
        userId,
        totalMemories: {
          semantic: semanticStats.totalMemories,
          episodic: episodicStats.totalEpisodes,
          shortTerm: shortTermStats.totalMessages
        },
        storageUsed: {
          memories: semanticStorageBytes + episodicStorageBytes,
          embeddings: embeddingStorageBytes,
          total: semanticStorageBytes + episodicStorageBytes + embeddingStorageBytes
        },
        monthlyActivity: {
          memoriesCreated: semanticStats.totalMemories, // Simplified
          memoriesAccessed: semanticStats.mostAccessedMemories.reduce((sum, mem) => sum + mem.accessCount, 0),
          conversationsWithMemory: episodicStats.totalEpisodes,
          modelSwitches: Object.keys(episodicStats.modelProviderStats).length
        },
        topCategories: Object.entries(semanticStats.categoryCounts)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        preferredModelProviders: Object.entries(episodicStats.modelProviderStats)
          .map(([provider, usage]) => ({ provider, usage }))
          .sort((a, b) => b.usage - a.usage),
        averageContextRetrievalTime: 150, // ms - would be tracked in production
        averageResponseQuality: episodicStats.averageSatisfaction,
        memoryEffectivenessScore: this.calculateMemoryEffectiveness(semanticStats, episodicStats)
      };
      
    } catch (error) {
      console.error('Error getting memory usage stats:', error);
      return {
        userId,
        totalMemories: { semantic: 0, episodic: 0, shortTerm: 0 },
        storageUsed: { memories: 0, embeddings: 0, total: 0 },
        monthlyActivity: { memoriesCreated: 0, memoriesAccessed: 0, conversationsWithMemory: 0, modelSwitches: 0 },
        topCategories: [],
        preferredModelProviders: [],
        averageContextRetrievalTime: 0,
        averageResponseQuality: 0,
        memoryEffectivenessScore: 0
      };
    }
  }

  /**
   * Get or create memory settings for a user
   */
  public async getMemorySettings(userId: string): Promise<MemorySettings> {
    try {
      const settingsRef = doc(db, 'memorySettings', userId);
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        return {
          userId: data.userId,
          memoryEnabled: data.memoryEnabled,
          dataRetentionDays: data.dataRetentionDays,
          shortTermMemoryEnabled: data.shortTermMemoryEnabled,
          semanticMemoryEnabled: data.semanticMemoryEnabled,
          episodicMemoryEnabled: data.episodicMemoryEnabled,
          allowCrossConversationMemory: data.allowCrossConversationMemory,
          allowModelProviderSharing: data.allowModelProviderSharing,
          exportFormat: data.exportFormat,
          memoryImportanceThreshold: data.memoryImportanceThreshold,
          maxSemanticMemories: data.maxSemanticMemories,
          maxEpisodicMemories: data.maxEpisodicMemories,
          preferredModelProvider: data.preferredModelProvider,
          adaptiveModelSelection: data.adaptiveModelSelection,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      } else {
        // Create default settings
        const defaultSettings: MemorySettings = {
          userId,
          memoryEnabled: true,
          dataRetentionDays: 0, // Keep forever by default
          shortTermMemoryEnabled: true,
          semanticMemoryEnabled: true,
          episodicMemoryEnabled: true,
          allowCrossConversationMemory: true,
          allowModelProviderSharing: true,
          exportFormat: 'json',
          memoryImportanceThreshold: 0.3,
          maxSemanticMemories: 1000,
          maxEpisodicMemories: 100,
          preferredModelProvider: 'auto',
          adaptiveModelSelection: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.saveMemorySettings(defaultSettings);
        return defaultSettings;
      }
      
    } catch (error) {
      console.error('Error getting memory settings:', error);
      // Return basic default settings on error
      return {
        userId,
        memoryEnabled: true,
        dataRetentionDays: 0,
        shortTermMemoryEnabled: true,
        semanticMemoryEnabled: true,
        episodicMemoryEnabled: true,
        allowCrossConversationMemory: true,
        allowModelProviderSharing: true,
        exportFormat: 'json',
        memoryImportanceThreshold: 0.3,
        maxSemanticMemories: 1000,
        maxEpisodicMemories: 100,
        preferredModelProvider: 'auto',
        adaptiveModelSelection: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  /**
   * Update memory settings for a user
   */
  public async updateMemorySettings(settings: MemorySettings): Promise<void> {
    try {
      settings.updatedAt = new Date();
      await this.saveMemorySettings(settings);
      console.log(`Updated memory settings for user: ${settings.userId}`);
    } catch (error) {
      console.error('Error updating memory settings:', error);
      throw error;
    }
  }

  /**
   * Clear all memories for a user (privacy/GDPR compliance)
   */
  public async clearAllUserMemories(userId: string): Promise<void> {
    try {
      console.log(`Clearing all memories for user: ${userId}`);

      // Get all conversations for this user first
      const conversationsQuery = query(
        collection(db, 'shortTermMemories'),
        where('userId', '==', userId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);

      // Clear short-term memories
      const clearPromises: Promise<void>[] = [];
      conversationsSnapshot.forEach((doc) => {
        const data = doc.data();
        clearPromises.push(
          this.shortTermService.clearShortTermMemory(data.conversationId, userId)
        );
      });

      // Clear semantic memories
      const semanticQuery = query(
        collection(db, 'semanticMemories'),
        where('userId', '==', userId)
      );
      const semanticSnapshot = await getDocs(semanticQuery);
      semanticSnapshot.forEach((doc) => {
        clearPromises.push(doc.ref.delete());
      });

      // Clear episodic memories
      const episodicQuery = query(
        collection(db, 'episodicMemories'),
        where('userId', '==', userId)
      );
      const episodicSnapshot = await getDocs(episodicQuery);
      episodicSnapshot.forEach((doc) => {
        clearPromises.push(doc.ref.delete());
      });

      await Promise.all(clearPromises);

      console.log(`Cleared all memories for user: ${userId}`);
      
    } catch (error) {
      console.error('Error clearing user memories:', error);
      throw error;
    }
  }

  // Private helper methods

  private calculateMessageImportance(message: Message): number {
    let importance = 0.5;

    // User messages are generally more important for memory
    if (message.role === 'user') importance += 0.2;

    // Content length factor
    if (message.content.length > 100) importance += 0.1;
    if (message.content.length > 500) importance += 0.1;

    // Presence of questions or statements that might need remembering
    const importantPatterns = [
      /my name is|i am|i work|i live/i,
      /i like|i prefer|i enjoy|i love/i,
      /remember|important|note|don't forget/i,
      /\?/g // Questions
    ];

    for (const pattern of importantPatterns) {
      if (pattern.test(message.content)) {
        importance += 0.15;
        break;
      }
    }

    return Math.min(importance, 1.0);
  }

  private estimateSemanticMemoryTokens(memories: SemanticMemory[]): number {
    return memories.reduce((total, memory) => {
      return total + Math.ceil(memory.content.length / 4);
    }, 0);
  }

  private estimateEpisodicMemoryTokens(memories: (EpisodicMemory & { similarity: number })[]): number {
    return memories.reduce((total, memory) => {
      return total + Math.ceil(memory.summary.length / 4) + 
             Math.ceil(memory.keyTopics.join(' ').length / 4);
    }, 0);
  }

  private hasImageContent(context: ConversationContext): boolean {
    // Check if any messages in short-term memory mention images
    return context.shortTermMemory.messages.some(msg => 
      msg.content.toLowerCase().includes('image') ||
      msg.content.toLowerCase().includes('photo') ||
      msg.content.toLowerCase().includes('picture')
    ) || context.relevantSemanticMemories.some(mem =>
      mem.category === 'creative' || mem.keywords.includes('image')
    );
  }

  private determineComplexity(context: ConversationContext, prompt: string): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // Length factors
    if (prompt.length > 500) complexityScore += 2;
    else if (prompt.length > 200) complexityScore += 1;

    // Memory context factors
    if (context.relevantSemanticMemories.length > 5) complexityScore += 1;
    if (context.relevantEpisodicMemories.length > 2) complexityScore += 1;
    if (context.shortTermMemory.messages.length > 10) complexityScore += 1;

    // Content complexity indicators
    const complexPatterns = [
      /analyze|complex|detailed|comprehensive/i,
      /multiple|various|several|different/i,
      /compare|contrast|evaluate|assess/i
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(prompt)) {
        complexityScore += 1;
        break;
      }
    }

    if (complexityScore >= 4) return 'high';
    if (complexityScore >= 2) return 'medium';
    return 'low';
  }

  private calculateMemoryEffectiveness(semanticStats: any, episodicStats: any): number {
    // Simple effectiveness metric based on usage patterns
    let score = 0.5; // Base score

    // More memories generally indicate active usage
    if (semanticStats.totalMemories > 50) score += 0.1;
    if (episodicStats.totalEpisodes > 10) score += 0.1;

    // Diversity of categories indicates varied usage
    if (Object.keys(semanticStats.categoryCounts).length > 3) score += 0.1;

    // Access patterns indicate usefulness
    const avgAccess = semanticStats.mostAccessedMemories.length > 0 
      ? semanticStats.mostAccessedMemories.reduce((sum: number, mem: any) => sum + mem.accessCount, 0) / semanticStats.mostAccessedMemories.length
      : 0;
    if (avgAccess > 2) score += 0.1;

    // Satisfaction indicates quality
    score += episodicStats.averageSatisfaction * 0.2;

    return Math.min(score, 1.0);
  }

  private async saveMemorySettings(settings: MemorySettings): Promise<void> {
    try {
      const settingsRef = doc(db, 'memorySettings', settings.userId);
      await setDoc(settingsRef, {
        userId: settings.userId,
        memoryEnabled: settings.memoryEnabled,
        dataRetentionDays: settings.dataRetentionDays,
        shortTermMemoryEnabled: settings.shortTermMemoryEnabled,
        semanticMemoryEnabled: settings.semanticMemoryEnabled,
        episodicMemoryEnabled: settings.episodicMemoryEnabled,
        allowCrossConversationMemory: settings.allowCrossConversationMemory,
        allowModelProviderSharing: settings.allowModelProviderSharing,
        exportFormat: settings.exportFormat,
        memoryImportanceThreshold: settings.memoryImportanceThreshold,
        maxSemanticMemories: settings.maxSemanticMemories,
        maxEpisodicMemories: settings.maxEpisodicMemories,
        preferredModelProvider: settings.preferredModelProvider,
        adaptiveModelSelection: settings.adaptiveModelSelection,
        createdAt: Timestamp.fromDate(settings.createdAt),
        updatedAt: Timestamp.fromDate(settings.updatedAt)
      });
    } catch (error) {
      console.error('Error saving memory settings:', error);
      throw error;
    }
  }
}