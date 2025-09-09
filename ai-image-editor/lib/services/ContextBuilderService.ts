// Context Builder Service for Cross-Model Memory Integration
// Single entry point for packing conversation context with memory

import { MemoryManagementService } from './MemoryManagementService';
import { ModelAdapterService, ModelRequest, ModelResponse } from './ModelAdapterService';
import { ConversationContext, Message, ConversationMetadata } from '@/lib/types/memory';

export interface ContextRequest {
  userId: string;
  conversationId: string;
  currentPrompt: string;
  images?: string[];
  modelPreference?: 'gemini' | 'gpt' | 'claude' | 'auto';
  maxTokens?: number;
  temperature?: number;
  mode?: 'chat' | 'image' | 'creative' | 'analytical';
}

export interface ContextResponse {
  success: boolean;
  content: string;
  modelUsed: string;
  provider: 'gemini' | 'gpt' | 'claude';
  tokenCount: {
    input: number;
    output: number;
    context: number;
  };
  processingTimeMs: number;
  cost: number;
  memoryUsed: {
    shortTerm: boolean;
    semantic: number;
    episodic: number;
  };
  error?: string;
}

export class ContextBuilderService {
  private static instance: ContextBuilderService;
  private memoryService: MemoryManagementService;
  private modelAdapter: ModelAdapterService;

  // System prompt template
  private readonly SYSTEM_PROMPT = `You are Pixtorai, a helpful multi-turn AI assistant.
Use "Known Facts" (retrieved memories), conversation summaries, and recent turns to maintain continuity. Prefer recent preferences over older ones. If context is missing, ask a brief clarifying question. Respect privacy: do not reveal hidden memories unless the user asks. Be clear, concise, and conversational; naturally reference prior context without repeating it verbatim.`;

  private constructor() {
    this.memoryService = MemoryManagementService.getInstance();
    this.modelAdapter = ModelAdapterService.getInstance();
  }

  public static getInstance(): ContextBuilderService {
    if (!ContextBuilderService.instance) {
      ContextBuilderService.instance = new ContextBuilderService();
    }
    return ContextBuilderService.instance;
  }

  /**
   * Main entry point: Generate response with memory context
   */
  public async generateResponse(request: ContextRequest): Promise<ContextResponse> {
    const startTime = Date.now();

    try {
      console.log(`Generating response for conversation: ${request.conversationId}`);

      // 1. Generate conversation context with memory
      const maxContextTokens = Math.floor((request.maxTokens || 8000) * 0.7); // Reserve 70% for context
      const conversationContext = await this.memoryService.generateConversationContext(
        request.conversationId,
        request.userId,
        request.currentPrompt,
        maxContextTokens
      );

      // 2. Build complete prompt with memory context
      const contextPrompt = this.buildContextualPrompt(
        conversationContext,
        request.currentPrompt,
        request.mode
      );

      // 3. Determine optimal model
      const modelConfig = this.modelAdapter.getOptimalModel(
        {
          task: request.currentPrompt,
          hasImages: request.images && request.images.length > 0,
          complexity: this.determineComplexity(request.currentPrompt, conversationContext)
        },
        conversationContext
      );

      // 4. Generate model request
      const modelRequest: ModelRequest = {
        prompt: contextPrompt,
        context: conversationContext,
        images: request.images,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        systemPrompt: this.SYSTEM_PROMPT,
        preferredProvider: request.modelPreference
      };

      // 5. Send to model adapter
      const modelResponse = await this.modelAdapter.generateResponse(modelRequest);

      // 6. Create conversation message for memory processing
      const userMessage: Message = {
        id: `msg_${Date.now()}_user`,
        conversationId: request.conversationId,
        userId: request.userId,
        content: request.currentPrompt,
        role: 'user',
        modelProvider: modelResponse.provider,
        modelId: modelResponse.modelUsed,
        timestamp: new Date(),
        contentType: request.images ? 'mixed' : 'text',
        imageUrls: request.images,
        memoryReferences: conversationContext.relevantSemanticMemories.map(m => m.id),
        success: true,
        tokenCount: modelResponse.tokenCount.input
      };

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        conversationId: request.conversationId,
        userId: request.userId,
        content: modelResponse.content,
        role: 'assistant',
        modelProvider: modelResponse.provider,
        modelId: modelResponse.modelUsed,
        timestamp: new Date(),
        contentType: 'text',
        memoryReferences: conversationContext.relevantSemanticMemories.map(m => m.id),
        success: modelResponse.success,
        tokenCount: modelResponse.tokenCount.output,
        processingTimeMs: modelResponse.processingTimeMs
      };

      // 7. Process messages for memory (async - don't wait)
      const conversationMetadata: ConversationMetadata = {
        id: request.conversationId,
        userId: request.userId,
        title: this.generateConversationTitle(request.currentPrompt),
        tags: this.extractTags(request.currentPrompt),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: (conversationContext.shortTermMemory.messages?.length || 0) + 2,
        isActive: true,
        type: request.images ? 'mixed' : 'text',
        memoryEnabled: true,
        privacyLevel: 'full'
      };

      // Process in background
      Promise.all([
        this.memoryService.processMessage(userMessage, conversationMetadata),
        this.memoryService.processMessage(assistantMessage, conversationMetadata)
      ]).catch(error => {
        console.error('Background memory processing error:', error);
      });

      // 8. Return response
      const processingTime = Date.now() - startTime;

      return {
        success: modelResponse.success,
        content: modelResponse.content,
        modelUsed: modelResponse.modelUsed,
        provider: modelResponse.provider,
        tokenCount: {
          input: modelResponse.tokenCount.input,
          output: modelResponse.tokenCount.output,
          context: conversationContext.totalTokenCount
        },
        processingTimeMs: processingTime,
        cost: modelResponse.cost,
        memoryUsed: {
          shortTerm: conversationContext.shortTermMemory.messages.length > 0,
          semantic: conversationContext.relevantSemanticMemories.length,
          episodic: conversationContext.relevantEpisodicMemories.length
        },
        error: modelResponse.error
      };

    } catch (error) {
      console.error('Error in context builder:', error);
      
      return {
        success: false,
        content: '',
        modelUsed: 'error',
        provider: 'gemini',
        tokenCount: { input: 0, output: 0, context: 0 },
        processingTimeMs: Date.now() - startTime,
        cost: 0,
        memoryUsed: { shortTerm: false, semantic: 0, episodic: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build contextual prompt with memory components
   */
  private buildContextualPrompt(
    context: ConversationContext,
    currentPrompt: string,
    mode?: string
  ): string {
    const parts: string[] = [];

    // 1. Mode-specific instructions
    if (mode) {
      const modeInstructions = this.getModeInstructions(mode);
      if (modeInstructions) {
        parts.push(`MODE: ${modeInstructions}`);
      }
    }

    // 2. Known facts from semantic memory
    if (context.relevantSemanticMemories.length > 0) {
      const facts = context.relevantSemanticMemories
        .slice(0, 8) // Limit to top 8 most relevant
        .map(memory => `- ${memory.content}`)
        .join('\n');
      
      parts.push(`KNOWN FACTS:\n${facts}`);
    }

    // 3. Conversation summaries from episodic memory
    if (context.relevantEpisodicMemories.length > 0) {
      const summaries = context.relevantEpisodicMemories
        .slice(0, 2) // Limit to 2 most relevant episodes
        .map(episode => `Previous conversation: ${episode.summary}`)
        .join('\n\n');
      
      parts.push(`CONVERSATION HISTORY:\n${summaries}`);
    }

    // 4. Recent conversation from short-term memory
    if (context.shortTermMemory.messages.length > 0) {
      const recentMessages = context.shortTermMemory.messages
        .slice(-8) // Last 8 messages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n');
      
      parts.push(`RECENT CONVERSATION:\n${recentMessages}`);
    }

    // 5. Current user prompt
    parts.push(`USER: ${currentPrompt}`);

    return parts.join('\n\n');
  }

  /**
   * Get mode-specific instructions
   */
  private getModeInstructions(mode: string): string | null {
    const instructions: Record<string, string> = {
      chat: 'Engage in natural conversation, maintaining context and personality.',
      image: 'Focus on image generation, editing, or visual analysis tasks.',
      creative: 'Emphasize creativity, imagination, and artistic expression.',
      analytical: 'Provide detailed analysis, reasoning, and logical explanations.'
    };

    return instructions[mode] || null;
  }

  /**
   * Determine task complexity for model selection
   */
  private determineComplexity(prompt: string, context: ConversationContext): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // Length factors
    if (prompt.length > 500) complexityScore += 2;
    else if (prompt.length > 200) complexityScore += 1;

    // Memory context factors
    if (context.relevantSemanticMemories.length > 5) complexityScore += 1;
    if (context.relevantEpisodicMemories.length > 1) complexityScore += 1;
    if (context.shortTermMemory.messages.length > 10) complexityScore += 1;

    // Content complexity indicators
    const complexPatterns = [
      /analyze|analysis|detailed|comprehensive|complex/i,
      /compare|contrast|evaluate|assess|review/i,
      /multiple|various|several|different|many/i,
      /step.by.step|explain|describe|how.to/i,
      /code|program|script|function|algorithm/i
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(prompt)) {
        complexityScore += 1;
      }
    }

    if (complexityScore >= 5) return 'high';
    if (complexityScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Generate conversation title from first prompt
   */
  private generateConversationTitle(prompt: string): string {
    // Extract key topics or use first few words
    const words = prompt.split(' ').slice(0, 6);
    let title = words.join(' ');
    
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    return title || 'New Conversation';
  }

  /**
   * Extract relevant tags from prompt
   */
  private extractTags(prompt: string): string[] {
    const tags: string[] = [];
    
    // Common topic patterns
    const tagPatterns: Record<string, RegExp> = {
      'creative': /creative|art|design|writing|story|poem|creative/i,
      'technical': /code|programming|technical|algorithm|function|debug/i,
      'analysis': /analyze|analysis|research|study|evaluate|compare/i,
      'help': /help|how.to|explain|guide|tutorial|learn/i,
      'image': /image|photo|picture|visual|generate|create/i,
      'personal': /my|me|i\s|personal|preference|like|love|enjoy/i
    };

    for (const [tag, pattern] of Object.entries(tagPatterns)) {
      if (pattern.test(prompt)) {
        tags.push(tag);
      }
    }

    return tags.length > 0 ? tags : ['general'];
  }

  /**
   * Utility: Check if memory system is healthy
   */
  public async getMemoryHealth(userId: string): Promise<{
    status: 'healthy' | 'warning' | 'error';
    score: number;
    details: Record<string, any>;
  }> {
    try {
      const stats = await this.memoryService.getMemoryUsageStats(userId);
      
      let score = 50; // Base score
      let status: 'healthy' | 'warning' | 'error' = 'healthy';

      // Factor in memory counts
      if (stats.totalMemories.semantic > 50) score += 20;
      if (stats.totalMemories.episodic > 10) score += 15;
      if (stats.totalMemories.shortTerm > 0) score += 15;

      // Effectiveness score
      score += stats.memoryEffectivenessScore * 0.2;

      if (score < 40) status = 'error';
      else if (score < 70) status = 'warning';

      return {
        status,
        score: Math.min(score, 100),
        details: {
          totalMemories: stats.totalMemories.semantic + stats.totalMemories.episodic,
          storageMB: stats.storageUsed.total / (1024 * 1024),
          effectiveness: stats.memoryEffectivenessScore,
          monthlyActivity: stats.monthlyActivity
        }
      };

    } catch (error) {
      return {
        status: 'error',
        score: 0,
        details: { error: 'Failed to assess memory health' }
      };
    }
  }

  /**
   * Utility: Reset conversation context (clear short-term memory)
   */
  public async resetConversationContext(conversationId: string, userId: string): Promise<void> {
    try {
      console.log(`Resetting conversation context: ${conversationId}`);
      // This would clear short-term memory but preserve long-term memories
      // Implementation would depend on the specific requirements
      
      // For now, we'll just log the action
      // In a full implementation, this might clear the short-term memory collection
      console.log(`Context reset completed for conversation: ${conversationId}`);
      
    } catch (error) {
      console.error('Error resetting conversation context:', error);
      throw error;
    }
  }
}