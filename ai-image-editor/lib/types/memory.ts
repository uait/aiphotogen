// Cross-model Conversational Memory & Context Management Types
// As specified in the PRD for continuous chat experience across model providers

export interface ConversationMetadata {
  id: string;
  userId: string;
  title: string;
  description?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  isActive: boolean;
  type: 'text' | 'image' | 'mixed';
  // Privacy and memory settings
  memoryEnabled: boolean;
  privacyLevel: 'full' | 'limited' | 'none';
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  role: 'user' | 'assistant';
  modelProvider: 'gemini' | 'gpt' | 'claude';
  modelId: string;
  timestamp: Date;
  // Content metadata
  contentType: 'text' | 'image' | 'mixed';
  imageUrls?: string[];
  attachments?: MessageAttachment[];
  // Context and memory
  memoryReferences?: string[]; // IDs of memories used in this message
  intentCategory?: string; // e.g., 'creative', 'analytical', 'casual'
  emotionalTone?: string; // e.g., 'positive', 'neutral', 'concerned'
  // Processing metadata
  processingTimeMs?: number;
  tokenCount?: number;
  success: boolean;
  errorMessage?: string;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'url';
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

// Short-term Memory (10-12 turn rolling window)
export interface ShortTermMemory {
  id: string;
  conversationId: string;
  userId: string;
  messages: ShortTermMessage[];
  windowSize: number; // default 12
  createdAt: Date;
  updatedAt: Date;
}

export interface ShortTermMessage {
  messageId: string;
  content: string;
  role: 'user' | 'assistant';
  modelProvider: 'gemini' | 'gpt' | 'claude';
  timestamp: Date;
  importance: number; // 0-1 scale for retention priority
}

// Long-term Semantic Memory (vector embeddings)
export interface SemanticMemory {
  id: string;
  userId: string;
  conversationId?: string; // optional, can span conversations
  content: string;
  embedding: number[]; // vector embedding
  // Metadata for retrieval
  category: string; // e.g., 'preference', 'fact', 'skill', 'context'
  keywords: string[];
  importance: number; // 0-1 scale
  confidence: number; // 0-1 scale for content accuracy
  // Temporal data
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  // Relationships
  relatedMemoryIds: string[];
  sourceMessageIds: string[];
  // Privacy
  privacyLevel: 'full' | 'limited' | 'none';
}

// Episodic Memory (conversation summaries)
export interface EpisodicMemory {
  id: string;
  userId: string;
  conversationId: string;
  // Summary content
  summary: string;
  keyTopics: string[];
  mainOutcomes: string[];
  userGoals: string[];
  assistantActions: string[];
  // Temporal data
  timespan: {
    startTime: Date;
    endTime: Date;
    duration: number; // in minutes
  };
  // Metadata
  messageCount: number;
  modelProvidersUsed: string[];
  contentTypes: string[]; // 'text', 'image', etc.
  // Classification
  category: string; // e.g., 'problem_solving', 'creative', 'informational'
  mood: string; // overall conversation mood
  satisfaction: number; // 0-1 scale if available
  // Context
  embedding: number[]; // for semantic similarity search
  importance: number; // 0-1 scale
  // Lifecycle
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
}

// Multi-model Adapter Types
export interface ModelProvider {
  id: 'gemini' | 'gpt' | 'claude';
  name: string;
  apiEndpoint?: string;
  models: ModelConfig[];
  capabilities: ModelCapability[];
  costPerToken: {
    input: number;
    output: number;
  };
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'gemini' | 'gpt' | 'claude';
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: ModelCapability[];
  pricing: {
    inputCostPer1kTokens: number;
    outputCostPer1kTokens: number;
  };
  // Model-specific configurations
  supportsImages: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  optimalFor: string[]; // e.g., ['creative', 'analytical', 'coding']
}

export interface ModelCapability {
  type: 'text' | 'image' | 'vision' | 'tools' | 'code' | 'reasoning';
  quality: 'basic' | 'good' | 'excellent';
}

// Context Management
export interface ConversationContext {
  id: string;
  conversationId: string;
  userId: string;
  // Memory components
  shortTermMemory: ShortTermMemory;
  relevantSemanticMemories: SemanticMemory[];
  relevantEpisodicMemories: EpisodicMemory[];
  // Context metadata
  totalTokenCount: number;
  memoryTokenCount: number;
  messageTokenCount: number;
  // Model selection
  recommendedModel: ModelConfig;
  modelSwitchReason?: string;
  // Generation metadata
  createdAt: Date;
  expiresAt?: Date; // for cache management
}

// Memory Management and Privacy
export interface MemorySettings {
  userId: string;
  // Global settings
  memoryEnabled: boolean;
  dataRetentionDays: number; // 0 = forever, >0 = auto-delete after N days
  // Memory type settings
  shortTermMemoryEnabled: boolean;
  semanticMemoryEnabled: boolean;
  episodicMemoryEnabled: boolean;
  // Privacy controls
  allowCrossConversationMemory: boolean;
  allowModelProviderSharing: boolean; // share memories across model providers
  // Export and deletion
  exportFormat: 'json' | 'markdown' | 'csv';
  // Advanced settings
  memoryImportanceThreshold: number; // 0-1, below this importance memories are auto-deleted
  maxSemanticMemories: number; // limit to prevent unbounded growth
  maxEpisodicMemories: number;
  // Personalization
  preferredModelProvider?: 'gemini' | 'gpt' | 'claude' | 'auto';
  adaptiveModelSelection: boolean; // automatically choose best model for task
  // Updated timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Memory Operations
export interface MemoryOperation {
  type: 'create' | 'retrieve' | 'update' | 'delete' | 'search';
  memoryType: 'short_term' | 'semantic' | 'episodic';
  query?: string;
  filters?: MemoryFilter;
  limit?: number;
  threshold?: number; // for similarity search
}

export interface MemoryFilter {
  conversationId?: string;
  category?: string;
  keywords?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  importance?: {
    min: number;
    max: number;
  };
  modelProvider?: string;
  privacyLevel?: string[];
}

// Memory Search Results
export interface MemorySearchResult {
  memories: {
    semantic: (SemanticMemory & { similarity: number })[];
    episodic: (EpisodicMemory & { similarity: number })[];
    shortTerm: ShortTermMessage[];
  };
  totalCount: number;
  searchTimeMs: number;
  query: string;
  filters: MemoryFilter;
}

// Usage Analytics
export interface MemoryUsageStats {
  userId: string;
  totalMemories: {
    semantic: number;
    episodic: number;
    shortTerm: number;
  };
  storageUsed: {
    memories: number; // bytes
    embeddings: number; // bytes
    total: number; // bytes
  };
  monthlyActivity: {
    memoriesCreated: number;
    memoriesAccessed: number;
    conversationsWithMemory: number;
    modelSwitches: number;
  };
  topCategories: { category: string; count: number }[];
  preferredModelProviders: { provider: string; usage: number }[];
  // Performance metrics
  averageContextRetrievalTime: number;
  averageResponseQuality: number; // if available from user feedback
  memoryEffectivenessScore: number; // derived metric
}

// Event Types for Memory System
export interface MemoryEvent {
  id: string;
  type: 'memory_created' | 'memory_accessed' | 'memory_updated' | 'memory_deleted' | 'model_switched' | 'context_generated';
  userId: string;
  conversationId: string;
  memoryId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

// Error Types
export interface MemoryError {
  code: string;
  message: string;
  type: 'retrieval' | 'storage' | 'embedding' | 'context' | 'model_switch';
  retryable: boolean;
  details?: Record<string, any>;
}