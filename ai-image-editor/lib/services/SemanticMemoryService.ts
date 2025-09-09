// Long-term Semantic Memory Service with Vector Embeddings
// Stores and retrieves knowledge, preferences, and context across conversations

import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, doc, setDoc, addDoc, query, where, orderBy, limit, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SemanticMemory, Message, MemorySettings, MemoryFilter, MemorySearchResult } from '@/lib/types/memory';

export class SemanticMemoryService {
  private static instance: SemanticMemoryService;
  private genAI: GoogleGenerativeAI;
  private embeddingModel: any;
  private readonly EMBEDDING_DIMENSION = 768; // Gemini embedding dimension
  private readonly SIMILARITY_THRESHOLD = 0.7;
  private readonly MAX_MEMORIES_PER_USER = 1000;

  private constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
  }

  public static getInstance(): SemanticMemoryService {
    if (!SemanticMemoryService.instance) {
      SemanticMemoryService.instance = new SemanticMemoryService();
    }
    return SemanticMemoryService.instance;
  }

  /**
   * Create semantic memory from a message
   */
  public async createMemoryFromMessage(
    message: Message,
    category: string = 'general',
    importance: number = 0.5,
    memorySettings?: MemorySettings
  ): Promise<SemanticMemory | null> {
    try {
      if (!memorySettings?.semanticMemoryEnabled) {
        return null;
      }

      // Extract meaningful content for memory storage
      const memoryContent = await this.extractMemoryContent(message);
      if (!memoryContent.trim()) {
        return null; // Skip if no meaningful content
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(memoryContent);
      if (!embedding) {
        throw new Error('Failed to generate embedding');
      }

      // Extract keywords
      const keywords = await this.extractKeywords(memoryContent);

      // Determine category if not provided
      if (category === 'general') {
        category = await this.categorizeContent(memoryContent);
      }

      // Create semantic memory
      const memory: SemanticMemory = {
        id: `sem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: message.userId,
        conversationId: message.conversationId,
        content: memoryContent,
        embedding,
        category,
        keywords,
        importance,
        confidence: this.calculateConfidence(message, memoryContent),
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
        relatedMemoryIds: [],
        sourceMessageIds: [message.id],
        privacyLevel: memorySettings?.allowCrossConversationMemory ? 'full' : 'limited'
      };

      // Check for similar existing memories to avoid duplicates
      const similarMemories = await this.findSimilarMemories(memory.userId, embedding, 0.9);
      if (similarMemories.length > 0) {
        // Update existing memory instead of creating duplicate
        return await this.updateExistingMemory(similarMemories[0], memory);
      }

      // Enforce memory limits
      await this.enforceMemoryLimits(message.userId, memorySettings);

      // Save to database
      await this.saveSemanticMemory(memory);

      console.log(`Created semantic memory: ${memory.id} (${category})`);
      return memory;
      
    } catch (error) {
      console.error('Error creating semantic memory:', error);
      return null;
    }
  }

  /**
   * Search semantic memories using vector similarity
   */
  public async searchMemories(
    userId: string,
    query: string,
    filters?: MemoryFilter,
    limit_count: number = 10,
    threshold: number = this.SIMILARITY_THRESHOLD
  ): Promise<MemorySearchResult> {
    const startTime = Date.now();
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Get candidate memories from database
      const candidates = await this.getCandidateMemories(userId, filters);

      // Calculate similarities and filter by threshold
      const results: (SemanticMemory & { similarity: number })[] = [];
      
      for (const memory of candidates) {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, memory.embedding);
        
        if (similarity >= threshold) {
          results.push({ ...memory, similarity });
          
          // Update access tracking
          await this.updateMemoryAccess(memory.id);
        }
      }

      // Sort by similarity and apply limit
      results.sort((a, b) => b.similarity - a.similarity);
      const limitedResults = results.slice(0, limit_count);

      const searchTimeMs = Date.now() - startTime;

      return {
        memories: {
          semantic: limitedResults,
          episodic: [], // Episodic search handled by EpisodicMemoryService
          shortTerm: [] // Short-term search handled by ShortTermMemoryService
        },
        totalCount: limitedResults.length,
        searchTimeMs,
        query,
        filters: filters || {}
      };
      
    } catch (error) {
      console.error('Error searching semantic memories:', error);
      return {
        memories: { semantic: [], episodic: [], shortTerm: [] },
        totalCount: 0,
        searchTimeMs: Date.now() - startTime,
        query,
        filters: filters || {}
      };
    }
  }

  /**
   * Get relevant memories for conversation context
   */
  public async getRelevantMemories(
    userId: string,
    conversationContext: string,
    maxMemories: number = 5
  ): Promise<SemanticMemory[]> {
    try {
      // Search for relevant memories
      const searchResult = await this.searchMemories(
        userId,
        conversationContext,
        undefined,
        maxMemories,
        0.6 // Lower threshold for context inclusion
      );

      return searchResult.memories.semantic;
      
    } catch (error) {
      console.error('Error getting relevant memories:', error);
      return [];
    }
  }

  /**
   * Update memory importance based on usage patterns
   */
  public async updateMemoryImportance(memoryId: string, accessPattern: 'frequent' | 'recent' | 'relevant'): Promise<void> {
    try {
      const memoryRef = doc(db, 'semanticMemories', memoryId);
      const memorySnap = await getDocs(query(collection(db, 'semanticMemories'), where('id', '==', memoryId)));
      
      if (memorySnap.empty) return;

      const memoryDoc = memorySnap.docs[0];
      const memory = memoryDoc.data();
      
      let importanceBoost = 0;
      switch (accessPattern) {
        case 'frequent':
          importanceBoost = 0.1;
          break;
        case 'recent':
          importanceBoost = 0.05;
          break;
        case 'relevant':
          importanceBoost = 0.15;
          break;
      }

      const newImportance = Math.min(memory.importance + importanceBoost, 1.0);
      
      await setDoc(memoryRef, {
        ...memory,
        importance: newImportance,
        lastAccessedAt: Timestamp.fromDate(new Date())
      }, { merge: true });
      
    } catch (error) {
      console.error('Error updating memory importance:', error);
    }
  }

  /**
   * Delete semantic memory
   */
  public async deleteMemory(memoryId: string, userId: string): Promise<boolean> {
    try {
      // Verify ownership
      const memorySnap = await getDocs(
        query(
          collection(db, 'semanticMemories'),
          where('id', '==', memoryId),
          where('userId', '==', userId)
        )
      );

      if (memorySnap.empty) {
        return false;
      }

      const memoryDoc = memorySnap.docs[0];
      await deleteDoc(memoryDoc.ref);
      
      console.log(`Deleted semantic memory: ${memoryId}`);
      return true;
      
    } catch (error) {
      console.error('Error deleting semantic memory:', error);
      return false;
    }
  }

  /**
   * Get memory statistics for a user
   */
  public async getMemoryStats(userId: string): Promise<{
    totalMemories: number;
    categoryCounts: { [category: string]: number };
    averageImportance: number;
    mostAccessedMemories: SemanticMemory[];
    oldestMemory: Date | null;
    newestMemory: Date | null;
  }> {
    try {
      const q = query(
        collection(db, 'semanticMemories'),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      const memories: SemanticMemory[] = [];
      const categoryCounts: { [category: string]: number } = {};
      let totalImportance = 0;
      let oldestMemory: Date | null = null;
      let newestMemory: Date | null = null;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const memory: SemanticMemory = {
          id: data.id,
          userId: data.userId,
          conversationId: data.conversationId,
          content: data.content,
          embedding: data.embedding,
          category: data.category,
          keywords: data.keywords,
          importance: data.importance,
          confidence: data.confidence,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastAccessedAt: data.lastAccessedAt?.toDate() || new Date(),
          accessCount: data.accessCount,
          relatedMemoryIds: data.relatedMemoryIds,
          sourceMessageIds: data.sourceMessageIds,
          privacyLevel: data.privacyLevel
        };

        memories.push(memory);
        
        // Count categories
        categoryCounts[memory.category] = (categoryCounts[memory.category] || 0) + 1;
        
        // Sum importance
        totalImportance += memory.importance;
        
        // Track date ranges
        if (!oldestMemory || memory.createdAt < oldestMemory) {
          oldestMemory = memory.createdAt;
        }
        if (!newestMemory || memory.createdAt > newestMemory) {
          newestMemory = memory.createdAt;
        }
      });

      // Sort by access count for most accessed
      const mostAccessedMemories = memories
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 5);

      return {
        totalMemories: memories.length,
        categoryCounts,
        averageImportance: memories.length > 0 ? totalImportance / memories.length : 0,
        mostAccessedMemories,
        oldestMemory,
        newestMemory
      };
      
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return {
        totalMemories: 0,
        categoryCounts: {},
        averageImportance: 0,
        mostAccessedMemories: [],
        oldestMemory: null,
        newestMemory: null
      };
    }
  }

  // Private helper methods

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
      throw new Error('Embeddings must have the same length');
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

  private async extractMemoryContent(message: Message): Promise<string> {
    // Extract meaningful content from message for memory storage
    let content = message.content.trim();

    // Filter out very short or meaningless content
    if (content.length < 10) return '';

    // Remove common filler words and phrases
    const fillerPatterns = [
      /^(ok|okay|yes|no|thanks|thank you|hi|hello|hey)\.?$/i,
      /^(lol|haha|hmm|uh|um|ah)\.?$/i
    ];

    for (const pattern of fillerPatterns) {
      if (pattern.test(content)) return '';
    }

    // Extract structured information for preferences, facts, etc.
    const structuredPatterns = [
      /i (like|love|enjoy|prefer|hate|dislike|need|want) ([^.!?]+)/gi,
      /my (name|favorite|job|work|hobby|interest) is ([^.!?]+)/gi,
      /i am (a|an|working as|studying|learning) ([^.!?]+)/gi,
      /remember that ([^.!?]+)/gi,
      /important: ([^.!?]+)/gi,
      /note: ([^.!?]+)/gi
    ];

    for (const pattern of structuredPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        return matches.join('. '); // Return structured content
      }
    }

    // For longer content, return as-is if it seems meaningful
    if (content.length > 50) {
      return content;
    }

    return '';
  }

  private async extractKeywords(content: string): Promise<string[]> {
    // Simple keyword extraction - in production, use more sophisticated NLP
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Remove common stop words
    const stopWords = new Set([
      'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know',
      'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
      'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over',
      'such', 'take', 'than', 'them', 'well', 'your'
    ]);

    const keywords = words.filter(word => !stopWords.has(word));
    
    // Return unique keywords, limited to top 10
    return [...new Set(keywords)].slice(0, 10);
  }

  private async categorizeContent(content: string): Promise<string> {
    // Simple content categorization - in production, use ML classification
    const categories = {
      'preference': /i (like|love|enjoy|prefer|hate|dislike)/i,
      'fact': /(my name|i am|i work|i study|i live)/i,
      'skill': /(i can|i know how|i learned|i studied)/i,
      'goal': /(i want|i need|i plan|my goal)/i,
      'problem': /(problem|issue|error|wrong|fix|help)/i,
      'creative': /(create|design|art|music|write|story)/i,
      'technical': /(code|program|software|api|database|algorithm)/i,
      'personal': /(family|friend|relationship|feeling|emotion)/i
    };

    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(content)) {
        return category;
      }
    }

    return 'general';
  }

  private calculateConfidence(message: Message, memoryContent: string): number {
    let confidence = 0.5; // Base confidence

    // Source reliability (user messages vs AI responses)
    if (message.role === 'user') {
      confidence += 0.2; // User statements are generally more reliable for personal info
    }

    // Content certainty indicators
    const certaintyPatterns = [
      /definitely|certainly|absolutely|sure|positive/i,
      /always|never|every time|usually/i,
      /my (name|job|hobby) is/i
    ];

    for (const pattern of certaintyPatterns) {
      if (pattern.test(memoryContent)) {
        confidence += 0.1;
        break;
      }
    }

    // Uncertainty indicators
    const uncertaintyPatterns = [
      /maybe|perhaps|might|probably|possibly/i,
      /i think|i believe|i guess|not sure/i
    ];

    for (const pattern of uncertaintyPatterns) {
      if (pattern.test(memoryContent)) {
        confidence -= 0.2;
        break;
      }
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private async findSimilarMemories(userId: string, embedding: number[], threshold: number): Promise<SemanticMemory[]> {
    try {
      // In a production system, you'd use a vector database like Pinecone or Weaviate
      // For now, we'll do a brute force similarity search
      const q = query(
        collection(db, 'semanticMemories'),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      const similarMemories: SemanticMemory[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const similarity = this.calculateCosineSimilarity(embedding, data.embedding);
        
        if (similarity >= threshold) {
          similarMemories.push({
            id: data.id,
            userId: data.userId,
            conversationId: data.conversationId,
            content: data.content,
            embedding: data.embedding,
            category: data.category,
            keywords: data.keywords,
            importance: data.importance,
            confidence: data.confidence,
            createdAt: data.createdAt?.toDate() || new Date(),
            lastAccessedAt: data.lastAccessedAt?.toDate() || new Date(),
            accessCount: data.accessCount,
            relatedMemoryIds: data.relatedMemoryIds,
            sourceMessageIds: data.sourceMessageIds,
            privacyLevel: data.privacyLevel
          });
        }
      });

      return similarMemories;
      
    } catch (error) {
      console.error('Error finding similar memories:', error);
      return [];
    }
  }

  private async updateExistingMemory(existingMemory: SemanticMemory, newMemory: SemanticMemory): Promise<SemanticMemory> {
    try {
      // Merge the memories by updating the existing one
      const updatedMemory: SemanticMemory = {
        ...existingMemory,
        content: `${existingMemory.content}\n\n${newMemory.content}`,
        keywords: [...new Set([...existingMemory.keywords, ...newMemory.keywords])],
        importance: Math.max(existingMemory.importance, newMemory.importance),
        confidence: (existingMemory.confidence + newMemory.confidence) / 2,
        lastAccessedAt: new Date(),
        accessCount: existingMemory.accessCount + 1,
        sourceMessageIds: [...existingMemory.sourceMessageIds, ...newMemory.sourceMessageIds]
      };

      await this.saveSemanticMemory(updatedMemory);
      return updatedMemory;
      
    } catch (error) {
      console.error('Error updating existing memory:', error);
      return existingMemory;
    }
  }

  private async getCandidateMemories(userId: string, filters?: MemoryFilter): Promise<SemanticMemory[]> {
    try {
      let q = query(collection(db, 'semanticMemories'), where('userId', '==', userId));

      // Apply filters
      if (filters?.category) {
        q = query(q, where('category', '==', filters.category));
      }
      if (filters?.conversationId) {
        q = query(q, where('conversationId', '==', filters.conversationId));
      }
      if (filters?.importance) {
        q = query(q, where('importance', '>=', filters.importance.min));
      }

      const snapshot = await getDocs(q);
      const memories: SemanticMemory[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        memories.push({
          id: data.id,
          userId: data.userId,
          conversationId: data.conversationId,
          content: data.content,
          embedding: data.embedding,
          category: data.category,
          keywords: data.keywords,
          importance: data.importance,
          confidence: data.confidence,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastAccessedAt: data.lastAccessedAt?.toDate() || new Date(),
          accessCount: data.accessCount,
          relatedMemoryIds: data.relatedMemoryIds,
          sourceMessageIds: data.sourceMessageIds,
          privacyLevel: data.privacyLevel
        });
      });

      return memories;
      
    } catch (error) {
      console.error('Error getting candidate memories:', error);
      return [];
    }
  }

  private async updateMemoryAccess(memoryId: string): Promise<void> {
    try {
      const memoryRef = doc(db, 'semanticMemories', memoryId);
      const memorySnap = await getDocs(query(collection(db, 'semanticMemories'), where('id', '==', memoryId)));
      
      if (!memorySnap.empty) {
        const memoryDoc = memorySnap.docs[0];
        const data = memoryDoc.data();
        
        await setDoc(memoryRef, {
          ...data,
          lastAccessedAt: Timestamp.fromDate(new Date()),
          accessCount: (data.accessCount || 0) + 1
        }, { merge: true });
      }
      
    } catch (error) {
      console.error('Error updating memory access:', error);
    }
  }

  private async enforceMemoryLimits(userId: string, memorySettings?: MemorySettings): Promise<void> {
    try {
      const maxMemories = memorySettings?.maxSemanticMemories || this.MAX_MEMORIES_PER_USER;
      
      const q = query(
        collection(db, 'semanticMemories'),
        where('userId', '==', userId),
        orderBy('importance', 'asc'),
        orderBy('lastAccessedAt', 'asc')
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.size >= maxMemories) {
        // Remove oldest, least important memories
        const toDelete = snapshot.size - maxMemories + 1;
        let deleted = 0;
        
        snapshot.forEach(async (doc) => {
          if (deleted < toDelete) {
            await deleteDoc(doc.ref);
            deleted++;
          }
        });
        
        console.log(`Deleted ${deleted} old semantic memories for user ${userId}`);
      }
      
    } catch (error) {
      console.error('Error enforcing memory limits:', error);
    }
  }

  private async saveSemanticMemory(memory: SemanticMemory): Promise<void> {
    try {
      const memoryRef = doc(db, 'semanticMemories', memory.id);
      
      await setDoc(memoryRef, {
        id: memory.id,
        userId: memory.userId,
        conversationId: memory.conversationId,
        content: memory.content,
        embedding: memory.embedding,
        category: memory.category,
        keywords: memory.keywords,
        importance: memory.importance,
        confidence: memory.confidence,
        createdAt: Timestamp.fromDate(memory.createdAt),
        lastAccessedAt: Timestamp.fromDate(memory.lastAccessedAt),
        accessCount: memory.accessCount,
        relatedMemoryIds: memory.relatedMemoryIds,
        sourceMessageIds: memory.sourceMessageIds,
        privacyLevel: memory.privacyLevel
      });
      
    } catch (error) {
      console.error('Error saving semantic memory:', error);
      throw error;
    }
  }
}