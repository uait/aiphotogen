// Multi-Model Adapter Layer for Cross-Provider Memory Continuity
// Provides unified interface for Gemini, GPT, and Claude

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ModelProvider, ModelConfig, ModelCapability, ConversationContext, Message } from '@/lib/types/memory';

export interface ModelRequest {
  prompt: string;
  context?: ConversationContext;
  images?: string[]; // base64 or URLs
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  preferredProvider?: 'gemini' | 'gpt' | 'claude' | 'auto';
}

export interface ModelResponse {
  content: string;
  modelUsed: string;
  provider: 'gemini' | 'gpt' | 'claude';
  tokenCount: {
    input: number;
    output: number;
  };
  processingTimeMs: number;
  cost: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export class ModelAdapterService {
  private static instance: ModelAdapterService;
  private geminiClient: GoogleGenerativeAI;
  private providers: Map<string, ModelProvider>;
  private models: Map<string, ModelConfig>;

  private constructor() {
    // Initialize API clients
    this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.providers = new Map();
    this.models = new Map();
    this.initializeProviders();
  }

  public static getInstance(): ModelAdapterService {
    if (!ModelAdapterService.instance) {
      ModelAdapterService.instance = new ModelAdapterService();
    }
    return ModelAdapterService.instance;
  }

  private initializeProviders(): void {
    // Gemini Provider Configuration
    const geminiProvider: ModelProvider = {
      id: 'gemini',
      name: 'Google Gemini',
      models: [
        {
          id: 'gemini-2.0-flash-exp',
          name: 'Gemini 2.0 Flash Experimental',
          provider: 'gemini',
          contextWindow: 32000,
          maxOutputTokens: 8192,
          capabilities: [
            { type: 'text', quality: 'excellent' },
            { type: 'reasoning', quality: 'excellent' },
            { type: 'code', quality: 'good' }
          ],
          pricing: { inputCostPer1kTokens: 0.075, outputCostPer1kTokens: 0.30 },
          supportsImages: false,
          supportsVision: false,
          supportsTools: true,
          optimalFor: ['conversation', 'reasoning', 'general']
        },
        {
          id: 'gemini-2.5-flash-image-preview',
          name: 'Gemini 2.5 Flash Image Preview',
          provider: 'gemini',
          contextWindow: 32000,
          maxOutputTokens: 8192,
          capabilities: [
            { type: 'text', quality: 'good' },
            { type: 'image', quality: 'excellent' },
            { type: 'vision', quality: 'excellent' }
          ],
          pricing: { inputCostPer1kTokens: 0.075, outputCostPer1kTokens: 0.30 },
          supportsImages: true,
          supportsVision: true,
          supportsTools: false,
          optimalFor: ['image_generation', 'image_editing', 'visual_analysis']
        }
      ],
      capabilities: [
        { type: 'text', quality: 'excellent' },
        { type: 'image', quality: 'excellent' },
        { type: 'vision', quality: 'excellent' },
        { type: 'reasoning', quality: 'excellent' }
      ],
      costPerToken: { input: 0.075, output: 0.30 },
      rateLimits: { requestsPerMinute: 60, tokensPerMinute: 1000000 }
    };

    // GPT Provider Configuration (for future implementation)
    const gptProvider: ModelProvider = {
      id: 'gpt',
      name: 'OpenAI GPT',
      models: [
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          provider: 'gpt',
          contextWindow: 128000,
          maxOutputTokens: 4096,
          capabilities: [
            { type: 'text', quality: 'excellent' },
            { type: 'reasoning', quality: 'excellent' },
            { type: 'code', quality: 'excellent' }
          ],
          pricing: { inputCostPer1kTokens: 10.0, outputCostPer1kTokens: 30.0 },
          supportsImages: false,
          supportsVision: false,
          supportsTools: true,
          optimalFor: ['complex_reasoning', 'analysis', 'coding']
        },
        {
          id: 'gpt-4-vision-preview',
          name: 'GPT-4 Vision Preview',
          provider: 'gpt',
          contextWindow: 128000,
          maxOutputTokens: 4096,
          capabilities: [
            { type: 'text', quality: 'excellent' },
            { type: 'vision', quality: 'excellent' },
            { type: 'reasoning', quality: 'excellent' }
          ],
          pricing: { inputCostPer1kTokens: 10.0, outputCostPer1kTokens: 30.0 },
          supportsImages: false,
          supportsVision: true,
          supportsTools: true,
          optimalFor: ['visual_analysis', 'complex_reasoning', 'detailed_analysis']
        }
      ],
      capabilities: [
        { type: 'text', quality: 'excellent' },
        { type: 'vision', quality: 'excellent' },
        { type: 'reasoning', quality: 'excellent' },
        { type: 'code', quality: 'excellent' }
      ],
      costPerToken: { input: 10.0, output: 30.0 },
      rateLimits: { requestsPerMinute: 60, tokensPerMinute: 150000 }
    };

    // Claude Provider Configuration (for future implementation)
    const claudeProvider: ModelProvider = {
      id: 'claude',
      name: 'Anthropic Claude',
      models: [
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'claude',
          contextWindow: 200000,
          maxOutputTokens: 8192,
          capabilities: [
            { type: 'text', quality: 'excellent' },
            { type: 'reasoning', quality: 'excellent' },
            { type: 'code', quality: 'excellent' }
          ],
          pricing: { inputCostPer1kTokens: 3.0, outputCostPer1kTokens: 15.0 },
          supportsImages: false,
          supportsVision: true,
          supportsTools: true,
          optimalFor: ['creative_writing', 'analysis', 'complex_reasoning']
        }
      ],
      capabilities: [
        { type: 'text', quality: 'excellent' },
        { type: 'vision', quality: 'good' },
        { type: 'reasoning', quality: 'excellent' }
      ],
      costPerToken: { input: 3.0, output: 15.0 },
      rateLimits: { requestsPerMinute: 60, tokensPerMinute: 80000 }
    };

    // Register providers and models
    [geminiProvider, gptProvider, claudeProvider].forEach(provider => {
      this.providers.set(provider.id, provider);
      provider.models.forEach(model => {
        this.models.set(model.id, model);
      });
    });
  }

  public getProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  public getModels(providerId?: string): ModelConfig[] {
    if (providerId) {
      const provider = this.providers.get(providerId);
      return provider ? provider.models : [];
    }
    return Array.from(this.models.values());
  }

  public getOptimalModel(
    requirements: {
      task: string;
      hasImages?: boolean;
      complexity?: 'low' | 'medium' | 'high';
      budget?: 'low' | 'medium' | 'high';
      speed?: 'fast' | 'balanced' | 'quality';
    },
    context?: ConversationContext
  ): ModelConfig {
    const { task, hasImages, complexity = 'medium', budget = 'medium', speed = 'balanced' } = requirements;

    // Filter models based on capabilities
    let candidates = Array.from(this.models.values());

    // Image/vision requirements
    if (hasImages) {
      candidates = candidates.filter(model => model.supportsImages || model.supportsVision);
    }

    // Task-specific filtering
    candidates = candidates.filter(model => {
      return model.optimalFor.some(use => {
        if (task.includes('image') || task.includes('visual')) {
          return use.includes('image') || use.includes('visual');
        }
        if (task.includes('code') || task.includes('programming')) {
          return use.includes('code') || use.includes('coding');
        }
        if (task.includes('creative') || task.includes('writing')) {
          return use.includes('creative') || use.includes('writing');
        }
        if (task.includes('analysis') || task.includes('reasoning')) {
          return use.includes('analysis') || use.includes('reasoning');
        }
        return use.includes('general') || use.includes('conversation');
      });
    });

    // If no specific matches, use general models
    if (candidates.length === 0) {
      candidates = Array.from(this.models.values()).filter(model => 
        model.optimalFor.includes('general') || model.optimalFor.includes('conversation')
      );
    }

    // Budget considerations
    if (budget === 'low') {
      candidates.sort((a, b) => a.pricing.inputCostPer1kTokens - b.pricing.inputCostPer1kTokens);
    } else if (budget === 'high') {
      // Prefer quality over cost
      candidates = candidates.filter(model => 
        model.capabilities.some(cap => cap.quality === 'excellent')
      );
    }

    // Speed considerations (Gemini is generally faster)
    if (speed === 'fast') {
      const geminiModels = candidates.filter(model => model.provider === 'gemini');
      if (geminiModels.length > 0) {
        candidates = geminiModels;
      }
    }

    // Default fallback
    return candidates[0] || this.models.get('gemini-2.0-flash-exp')!;
  }

  public async generateResponse(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    
    try {
      // Determine which model to use
      let modelConfig: ModelConfig;
      
      if (request.preferredProvider && request.preferredProvider !== 'auto') {
        const providerModels = this.getModels(request.preferredProvider);
        modelConfig = providerModels[0]; // Use first available model from preferred provider
      } else {
        // Auto-select optimal model
        modelConfig = this.getOptimalModel({
          task: request.prompt,
          hasImages: request.images && request.images.length > 0,
          complexity: request.prompt.length > 1000 ? 'high' : 'medium'
        }, request.context);
      }

      // Route to appropriate provider
      switch (modelConfig.provider) {
        case 'gemini':
          return await this.generateGeminiResponse(request, modelConfig);
        case 'gpt':
          return await this.generateGPTResponse(request, modelConfig);
        case 'claude':
          return await this.generateClaudeResponse(request, modelConfig);
        default:
          throw new Error(`Unsupported provider: ${modelConfig.provider}`);
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      return {
        content: '',
        modelUsed: 'error',
        provider: 'gemini', // fallback
        tokenCount: { input: 0, output: 0 },
        processingTimeMs: processingTime,
        cost: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async generateGeminiResponse(request: ModelRequest, modelConfig: ModelConfig): Promise<ModelResponse> {
    const startTime = Date.now();
    
    try {
      const model = this.geminiClient.getGenerativeModel({ model: modelConfig.id });
      
      // Prepare content parts
      const parts: any[] = [];
      
      // Add system prompt if provided
      if (request.systemPrompt) {
        parts.push({ text: `System: ${request.systemPrompt}\n\nUser: ${request.prompt}` });
      } else {
        parts.push({ text: request.prompt });
      }
      
      // Add images if supported and provided
      if (request.images && request.images.length > 0 && modelConfig.supportsVision) {
        for (const imageData of request.images) {
          if (imageData.startsWith('data:')) {
            // Base64 data URL
            const [mimeType, base64] = imageData.split(',');
            const mime = mimeType.split(':')[1].split(';')[0];
            parts.push({
              inlineData: {
                mimeType: mime,
                data: base64
              }
            });
          }
        }
      }
      
      // Include conversation context if available
      let conversationHistory: any[] = [];
      if (request.context?.shortTermMemory?.messages) {
        conversationHistory = request.context.shortTermMemory.messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));
      }
      
      // Generate response
      const result = await model.generateContent({
        contents: conversationHistory.length > 0 
          ? [...conversationHistory, { role: 'user', parts }]
          : [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: request.maxTokens || modelConfig.maxOutputTokens,
          temperature: request.temperature || 0.8
        }
      });
      
      const response = await result.response;
      const text = response.text();
      
      // Calculate tokens (approximation)
      const inputTokens = Math.ceil((request.prompt.length + (request.systemPrompt?.length || 0)) / 4);
      const outputTokens = Math.ceil(text.length / 4);
      
      // Calculate cost
      const cost = (inputTokens * modelConfig.pricing.inputCostPer1kTokens / 1000) +
                   (outputTokens * modelConfig.pricing.outputCostPer1kTokens / 1000);
      
      const processingTime = Date.now() - startTime;
      
      return {
        content: text,
        modelUsed: modelConfig.id,
        provider: 'gemini',
        tokenCount: { input: inputTokens, output: outputTokens },
        processingTimeMs: processingTime,
        cost,
        success: true
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      return {
        content: '',
        modelUsed: modelConfig.id,
        provider: 'gemini',
        tokenCount: { input: 0, output: 0 },
        processingTimeMs: processingTime,
        cost: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Gemini API error'
      };
    }
  }

  private async generateGPTResponse(request: ModelRequest, modelConfig: ModelConfig): Promise<ModelResponse> {
    // TODO: Implement GPT integration
    // For now, return placeholder response
    return {
      content: 'GPT integration coming soon. This is a placeholder response.',
      modelUsed: modelConfig.id,
      provider: 'gpt',
      tokenCount: { input: 0, output: 0 },
      processingTimeMs: 100,
      cost: 0,
      success: false,
      error: 'GPT integration not yet implemented'
    };
  }

  private async generateClaudeResponse(request: ModelRequest, modelConfig: ModelConfig): Promise<ModelResponse> {
    // TODO: Implement Claude integration
    // For now, return placeholder response
    return {
      content: 'Claude integration coming soon. This is a placeholder response.',
      modelUsed: modelConfig.id,
      provider: 'claude',
      tokenCount: { input: 0, output: 0 },
      processingTimeMs: 100,
      cost: 0,
      success: false,
      error: 'Claude integration not yet implemented'
    };
  }

  // Utility methods for model selection
  public canHandleImages(modelId: string): boolean {
    const model = this.models.get(modelId);
    return model ? (model.supportsImages || model.supportsVision) : false;
  }

  public getModelCapabilities(modelId: string): ModelCapability[] {
    const model = this.models.get(modelId);
    return model ? model.capabilities : [];
  }

  public estimateCost(prompt: string, modelId: string, outputLength: number = 500): number {
    const model = this.models.get(modelId);
    if (!model) return 0;
    
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(outputLength / 4);
    
    return (inputTokens * model.pricing.inputCostPer1kTokens / 1000) +
           (outputTokens * model.pricing.outputCostPer1kTokens / 1000);
  }

  public compareModels(modelIds: string[]): { modelId: string, score: number }[] {
    return modelIds.map(id => {
      const model = this.models.get(id);
      if (!model) return { modelId: id, score: 0 };
      
      // Simple scoring based on capabilities and cost
      const capabilityScore = model.capabilities.reduce((score, cap) => {
        return score + (cap.quality === 'excellent' ? 3 : cap.quality === 'good' ? 2 : 1);
      }, 0);
      
      const costScore = 10 - (model.pricing.inputCostPer1kTokens / 2); // Lower cost = higher score
      const score = (capabilityScore + costScore) / 2;
      
      return { modelId: id, score };
    }).sort((a, b) => b.score - a.score);
  }
}