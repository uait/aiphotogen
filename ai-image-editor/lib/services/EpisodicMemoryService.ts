// Episodic Memory Service for Conversation Summaries
// Creates and manages high-level summaries of conversation episodes

import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EpisodicMemory, Message, MemorySettings, ConversationMetadata, ShortTermMemory } from '@/lib/types/memory';
import { ModelAdapterService } from './ModelAdapterService';

export class EpisodicMemoryService {
  private static instance: EpisodicMemoryService;
  private genAI: GoogleGenerativeAI;
  private embeddingModel: any;
  private modelAdapter: ModelAdapterService;
  private readonly MIN_MESSAGES_FOR_EPISODE = 5;
  private readonly MAX_EPISODES_PER_USER = 100;

  private constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    this.modelAdapter = ModelAdapterService.getInstance();
  }

  public static getInstance(): EpisodicMemoryService {
    if (!EpisodicMemoryService.instance) {
      EpisodicMemoryService.instance = new EpisodicMemoryService();
    }
    return EpisodicMemoryService.instance;
  }

  /**
   * Create episodic memory from a completed conversation
   */
  public async createEpisodicMemory(
    conversationId: string,
    userId: string,
    messages: Message[],
    metadata: ConversationMetadata,
    memorySettings?: MemorySettings
  ): Promise<EpisodicMemory | null> {
    try {
      if (!memorySettings?.episodicMemoryEnabled || messages.length < this.MIN_MESSAGES_FOR_EPISODE) {
        return null;
      }

      console.log(`Creating episodic memory for conversation: ${conversationId}`);

      // Generate comprehensive summary
      const summary = await this.generateConversationSummary(messages, metadata);
      if (!summary.summary.trim()) {
        return null;
      }

      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(summary.summary);
      if (!embedding) {
        throw new Error('Failed to generate embedding for episodic memory');
      }

      // Calculate conversation timespan
      const timespan = this.calculateTimespan(messages);

      // Analyze conversation characteristics
      const characteristics = await this.analyzeConversationCharacteristics(messages);

      // Create episodic memory
      const episodicMemory: EpisodicMemory = {
        id: `epi_${conversationId}_${Date.now()}`,
        userId,
        conversationId,
        summary: summary.summary,
        keyTopics: summary.keyTopics,
        mainOutcomes: summary.mainOutcomes,
        userGoals: summary.userGoals,
        assistantActions: summary.assistantActions,
        timespan,
        messageCount: messages.length,
        modelProvidersUsed: this.extractModelProviders(messages),
        contentTypes: this.extractContentTypes(messages),
        category: characteristics.category,
        mood: characteristics.mood,
        satisfaction: characteristics.satisfaction,
        embedding,
        importance: this.calculateEpisodeImportance(messages, summary, characteristics),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Enforce episode limits
      await this.enforceEpisodeLimits(userId, memorySettings);

      // Save to database
      await this.saveEpisodicMemory(episodicMemory);

      console.log(`Created episodic memory: ${episodicMemory.id} (${episodicMemory.category})`);
      return episodicMemory;
      
    } catch (error) {
      console.error('Error creating episodic memory:', error);
      return null;
    }
  }

  /**
   * Search episodic memories for relevant conversation history
   */
  public async searchEpisodicMemories(
    userId: string,
    query: string,
    limit_count: number = 5,
    threshold: number = 0.6
  ): Promise<(EpisodicMemory & { similarity: number })[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return [];
      }

      // Get all user's episodic memories
      const q = query(
        collection(db, 'episodicMemories'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const results: (EpisodicMemory & { similarity: number })[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const memory: EpisodicMemory = {
          id: data.id,
          userId: data.userId,
          conversationId: data.conversationId,
          summary: data.summary,
          keyTopics: data.keyTopics,
          mainOutcomes: data.mainOutcomes,
          userGoals: data.userGoals,
          assistantActions: data.assistantActions,
          timespan: {
            startTime: data.timespan.startTime?.toDate() || new Date(),
            endTime: data.timespan.endTime?.toDate() || new Date(),
            duration: data.timespan.duration
          },
          messageCount: data.messageCount,
          modelProvidersUsed: data.modelProvidersUsed,
          contentTypes: data.contentTypes,
          category: data.category,
          mood: data.mood,
          satisfaction: data.satisfaction,
          embedding: data.embedding,
          importance: data.importance,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastAccessedAt: data.lastAccessedAt?.toDate()
        };

        // Calculate similarity
        const similarity = this.calculateCosineSimilarity(queryEmbedding, memory.embedding);
        
        if (similarity >= threshold) {
          results.push({ ...memory, similarity });
        }
      });

      // Sort by similarity and importance
      results.sort((a, b) => {
        const aScore = a.similarity * a.importance;
        const bScore = b.similarity * b.importance;
        return bScore - aScore;
      });

      // Update access tracking for returned results
      for (const result of results.slice(0, limit_count)) {
        await this.updateAccessTracking(result.id);
      }

      return results.slice(0, limit_count);
      
    } catch (error) {
      console.error('Error searching episodic memories:', error);
      return [];
    }
  }

  /**
   * Get recent conversation summaries for context
   */
  public async getRecentEpisodes(userId: string, limit_count: number = 10): Promise<EpisodicMemory[]> {
    try {
      const q = query(
        collection(db, 'episodicMemories'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limit_count)
      );

      const snapshot = await getDocs(q);
      const episodes: EpisodicMemory[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        episodes.push({
          id: data.id,
          userId: data.userId,
          conversationId: data.conversationId,
          summary: data.summary,
          keyTopics: data.keyTopics,
          mainOutcomes: data.mainOutcomes,
          userGoals: data.userGoals,
          assistantActions: data.assistantActions,
          timespan: {
            startTime: data.timespan.startTime?.toDate() || new Date(),
            endTime: data.timespan.endTime?.toDate() || new Date(),
            duration: data.timespan.duration
          },
          messageCount: data.messageCount,
          modelProvidersUsed: data.modelProvidersUsed,
          contentTypes: data.contentTypes,
          category: data.category,
          mood: data.mood,
          satisfaction: data.satisfaction,
          embedding: data.embedding,
          importance: data.importance,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastAccessedAt: data.lastAccessedAt?.toDate()
        });
      });

      return episodes;
      
    } catch (error) {
      console.error('Error getting recent episodes:', error);
      return [];
    }
  }

  /**
   * Get episodic memory statistics
   */
  public async getEpisodicStats(userId: string): Promise<{
    totalEpisodes: number;
    categoryCounts: { [category: string]: number };
    averageDuration: number;
    averageSatisfaction: number;
    modelProviderStats: { [provider: string]: number };
    oldestEpisode: Date | null;
    newestEpisode: Date | null;
  }> {
    try {
      const q = query(
        collection(db, 'episodicMemories'),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      const stats = {
        totalEpisodes: 0,
        categoryCounts: {} as { [category: string]: number },
        averageDuration: 0,
        averageSatisfaction: 0,
        modelProviderStats: {} as { [provider: string]: number },
        oldestEpisode: null as Date | null,
        newestEpisode: null as Date | null
      };

      let totalDuration = 0;
      let totalSatisfaction = 0;
      let satisfactionCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        stats.totalEpisodes++;

        // Category counts
        stats.categoryCounts[data.category] = (stats.categoryCounts[data.category] || 0) + 1;

        // Duration tracking
        totalDuration += data.timespan.duration;

        // Satisfaction tracking
        if (data.satisfaction > 0) {
          totalSatisfaction += data.satisfaction;
          satisfactionCount++;
        }

        // Model provider stats
        data.modelProvidersUsed.forEach((provider: string) => {
          stats.modelProviderStats[provider] = (stats.modelProviderStats[provider] || 0) + 1;
        });

        // Date tracking
        const createdAt = data.createdAt?.toDate() || new Date();
        if (!stats.oldestEpisode || createdAt < stats.oldestEpisode) {
          stats.oldestEpisode = createdAt;
        }
        if (!stats.newestEpisode || createdAt > stats.newestEpisode) {
          stats.newestEpisode = createdAt;
        }
      });

      stats.averageDuration = stats.totalEpisodes > 0 ? totalDuration / stats.totalEpisodes : 0;
      stats.averageSatisfaction = satisfactionCount > 0 ? totalSatisfaction / satisfactionCount : 0;

      return stats;
      
    } catch (error) {
      console.error('Error getting episodic stats:', error);
      return {
        totalEpisodes: 0,
        categoryCounts: {},
        averageDuration: 0,
        averageSatisfaction: 0,
        modelProviderStats: {},
        oldestEpisode: null,
        newestEpisode: null
      };
    }
  }

  // Private helper methods

  private async generateConversationSummary(
    messages: Message[],
    metadata: ConversationMetadata
  ): Promise<{
    summary: string;
    keyTopics: string[];
    mainOutcomes: string[];
    userGoals: string[];
    assistantActions: string[];
  }> {
    try {
      // Prepare conversation text for analysis
      const conversationText = messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');

      // Generate summary using model adapter
      const summaryPrompt = `
Analyze this conversation and provide a comprehensive summary:

CONVERSATION:
${conversationText}

Please provide:
1. A concise summary (2-3 sentences) of the main conversation
2. Key topics discussed (3-5 topics)
3. Main outcomes or results achieved
4. User's goals or objectives
5. Assistant's key actions or contributions

Format your response as JSON:
{
  "summary": "...",
  "keyTopics": ["topic1", "topic2", ...],
  "mainOutcomes": ["outcome1", "outcome2", ...],
  "userGoals": ["goal1", "goal2", ...],
  "assistantActions": ["action1", "action2", ...]
}`;

      const response = await this.modelAdapter.generateResponse({
        prompt: summaryPrompt,
        preferredProvider: 'gemini',
        temperature: 0.3 // Lower temperature for more consistent analysis
      });

      if (response.success) {
        try {
          const analysis = JSON.parse(response.content);
          return {
            summary: analysis.summary || '',
            keyTopics: analysis.keyTopics || [],
            mainOutcomes: analysis.mainOutcomes || [],
            userGoals: analysis.userGoals || [],
            assistantActions: analysis.assistantActions || []
          };
        } catch (parseError) {
          console.error('Error parsing summary JSON:', parseError);
          // Fallback to simple summary
          return this.createFallbackSummary(messages, metadata);
        }
      }

      return this.createFallbackSummary(messages, metadata);
      
    } catch (error) {
      console.error('Error generating conversation summary:', error);
      return this.createFallbackSummary(messages, metadata);
    }
  }

  private createFallbackSummary(
    messages: Message[],
    metadata: ConversationMetadata
  ): {
    summary: string;
    keyTopics: string[];
    mainOutcomes: string[];
    userGoals: string[];
    assistantActions: string[];
  } {
    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');

    return {
      summary: `${metadata.type} conversation with ${messages.length} messages. ` +
               `User initiated ${userMessages.length} interactions, assistant provided ${assistantMessages.length} responses.`,
      keyTopics: [metadata.type === 'image' ? 'image editing' : 'text conversation'],
      mainOutcomes: ['Conversation completed'],
      userGoals: ['Information or assistance'],
      assistantActions: ['Provided responses and assistance']
    };
  }

  private calculateTimespan(messages: Message[]): {
    startTime: Date;
    endTime: Date;
    duration: number;
  } {
    if (messages.length === 0) {
      const now = new Date();
      return { startTime: now, endTime: now, duration: 0 };
    }

    const startTime = messages[0].timestamp;
    const endTime = messages[messages.length - 1].timestamp;
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // Duration in minutes

    return { startTime, endTime, duration };
  }

  private async analyzeConversationCharacteristics(messages: Message[]): Promise<{
    category: string;
    mood: string;
    satisfaction: number;
  }> {
    try {
      // Simple rule-based analysis - in production, use more sophisticated NLP
      const conversationText = messages
        .map(msg => msg.content)
        .join(' ')
        .toLowerCase();

      // Categorization
      let category = 'general';
      if (conversationText.includes('image') || conversationText.includes('photo') || 
          conversationText.includes('generate') || conversationText.includes('create')) {
        category = 'creative';
      } else if (conversationText.includes('problem') || conversationText.includes('error') || 
                 conversationText.includes('help') || conversationText.includes('fix')) {
        category = 'problem_solving';
      } else if (conversationText.includes('learn') || conversationText.includes('explain') || 
                 conversationText.includes('how') || conversationText.includes('what')) {
        category = 'informational';
      } else if (conversationText.includes('code') || conversationText.includes('program') || 
                 conversationText.includes('software')) {
        category = 'technical';
      }

      // Mood analysis
      let mood = 'neutral';
      if (conversationText.includes('thank') || conversationText.includes('great') || 
          conversationText.includes('awesome') || conversationText.includes('perfect')) {
        mood = 'positive';
      } else if (conversationText.includes('frustrated') || conversationText.includes('angry') || 
                 conversationText.includes('difficult') || conversationText.includes('wrong')) {
        mood = 'negative';
      }

      // Satisfaction estimation (basic heuristic)
      let satisfaction = 0.5; // Default neutral
      if (mood === 'positive') satisfaction = 0.8;
      if (mood === 'negative') satisfaction = 0.2;
      
      // Adjust based on conversation completion
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'user' && 
          (lastMessage.content.includes('thank') || lastMessage.content.includes('perfect'))) {
        satisfaction = Math.min(satisfaction + 0.2, 1.0);
      }

      return { category, mood, satisfaction };
      
    } catch (error) {
      console.error('Error analyzing conversation characteristics:', error);
      return { category: 'general', mood: 'neutral', satisfaction: 0.5 };
    }
  }

  private extractModelProviders(messages: Message[]): string[] {
    const providers = new Set<string>();
    messages.forEach(msg => {
      if (msg.modelProvider) {
        providers.add(msg.modelProvider);
      }
    });
    return Array.from(providers);
  }

  private extractContentTypes(messages: Message[]): string[] {
    const types = new Set<string>();
    messages.forEach(msg => {
      if (msg.contentType) {
        types.add(msg.contentType);
      } else if (msg.imageUrls && msg.imageUrls.length > 0) {
        types.add('image');
      } else {
        types.add('text');
      }
    });
    return Array.from(types);
  }

  private calculateEpisodeImportance(
    messages: Message[],
    summary: any,
    characteristics: any
  ): number {
    let importance = 0.5; // Base importance

    // Length factor
    if (messages.length > 20) importance += 0.2;
    else if (messages.length > 10) importance += 0.1;

    // Content richness
    if (summary.keyTopics.length > 3) importance += 0.1;
    if (summary.mainOutcomes.length > 2) importance += 0.1;

    // User satisfaction
    importance += characteristics.satisfaction * 0.2;

    // Problem solving conversations are often more important
    if (characteristics.category === 'problem_solving') importance += 0.15;

    // Creative conversations can be important for context
    if (characteristics.category === 'creative') importance += 0.1;

    return Math.min(importance, 1.0);
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private async updateAccessTracking(episodeId: string): Promise<void> {
    try {
      const episodeRef = doc(db, 'episodicMemories', episodeId);
      await setDoc(episodeRef, {
        lastAccessedAt: Timestamp.fromDate(new Date())
      }, { merge: true });
    } catch (error) {
      console.error('Error updating access tracking:', error);
    }
  }

  private async enforceEpisodeLimits(userId: string, memorySettings?: MemorySettings): Promise<void> {
    try {
      const maxEpisodes = memorySettings?.maxEpisodicMemories || this.MAX_EPISODES_PER_USER;
      
      const q = query(
        collection(db, 'episodicMemories'),
        where('userId', '==', userId),
        orderBy('importance', 'asc'),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.size >= maxEpisodes) {
        // Remove oldest, least important episodes
        const toDelete = snapshot.size - maxEpisodes + 1;
        let deleted = 0;
        
        snapshot.forEach(async (doc) => {
          if (deleted < toDelete) {
            await doc.ref.delete();
            deleted++;
          }
        });
        
        console.log(`Deleted ${deleted} old episodic memories for user ${userId}`);
      }
      
    } catch (error) {
      console.error('Error enforcing episode limits:', error);
    }
  }

  private async saveEpisodicMemory(memory: EpisodicMemory): Promise<void> {
    try {
      const memoryRef = doc(db, 'episodicMemories', memory.id);
      
      await setDoc(memoryRef, {
        id: memory.id,
        userId: memory.userId,
        conversationId: memory.conversationId,
        summary: memory.summary,
        keyTopics: memory.keyTopics,
        mainOutcomes: memory.mainOutcomes,
        userGoals: memory.userGoals,
        assistantActions: memory.assistantActions,
        timespan: {
          startTime: Timestamp.fromDate(memory.timespan.startTime),
          endTime: Timestamp.fromDate(memory.timespan.endTime),
          duration: memory.timespan.duration
        },
        messageCount: memory.messageCount,
        modelProvidersUsed: memory.modelProvidersUsed,
        contentTypes: memory.contentTypes,
        category: memory.category,
        mood: memory.mood,
        satisfaction: memory.satisfaction,
        embedding: memory.embedding,
        importance: memory.importance,
        createdAt: Timestamp.fromDate(memory.createdAt),
        updatedAt: Timestamp.fromDate(memory.updatedAt),
        lastAccessedAt: memory.lastAccessedAt ? Timestamp.fromDate(memory.lastAccessedAt) : null
      });
      
    } catch (error) {
      console.error('Error saving episodic memory:', error);
      throw error;
    }
  }
}