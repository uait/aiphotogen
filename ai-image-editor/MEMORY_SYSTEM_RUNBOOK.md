# Cross-Model Conversational Memory System - Runbook

## 🎯 Overview

This document provides comprehensive guidance for the cross-model conversational memory system implemented for PixtorAI. The system enables continuous context across conversations with provider-agnostic memory management.

## 🧠 Memory Architecture

### System Prompt (Applied to Every Request)
```
You are Pixtorai, a helpful multi-turn AI assistant.
Use "Known Facts" (retrieved memories), conversation summaries, and recent turns to maintain continuity. Prefer recent preferences over older ones. If context is missing, ask a brief clarifying question. Respect privacy: do not reveal hidden memories unless the user asks. Be clear, concise, and conversational; naturally reference prior context without repeating it verbatim.
```

### Memory Layers

1. **Short-Term Memory (10-12 turn rolling window)**
   - Recent conversation context
   - Stored in: `shortTermMemories` collection
   - Key format: `{conversationId}_{userId}`

2. **Semantic Memory (Long-term facts & preferences)**
   - User preferences, facts, and learned information
   - Stored in: `semanticMemories` collection
   - Vector embeddings for similarity search

3. **Episodic Memory (Conversation summaries)**
   - High-level conversation summaries
   - Stored in: `episodicMemories` collection
   - Created when conversations reach 15+ turns

## 🏗️ Context Builder Process

### Token Budget Management
- **Maximum Input Tokens**: 8000 (configurable)
- **Context Allocation**: ≤70% of input tokens
- **Priority Order**:
  1. System prompt (always included)
  2. Known facts from semantic memory (30% of remaining)
  3. Conversation summaries (20% of remaining)
  4. Recent messages (50% of remaining)
  5. Current user prompt

### Context Packing Algorithm
```typescript
// 1. Start with system prompt
context = systemPrompt

// 2. Add relevant semantic memories (top 8)
if (semanticMemoryEnabled) {
  relevantFacts = searchSemanticMemories(userPrompt, limit: 8)
  context += formatKnownFacts(relevantFacts)
}

// 3. Add episodic summaries (top 2)
if (episodicMemoryEnabled) {
  summaries = getRecentEpisodes(userId, limit: 2)
  context += formatConversationHistory(summaries)
}

// 4. Add recent messages (last 8)
if (shortTermMemoryEnabled) {
  recentMessages = getShortTermMemory(conversationId, userId)
  context += formatRecentConversation(recentMessages.slice(-8))
}

// 5. Add current prompt
context += `USER: ${currentPrompt}`
```

## 🔧 Model Adapters

### Adding a New Model Provider

1. **Update ModelAdapterService.ts**:
```typescript
// Add provider configuration
const newProvider: ModelProvider = {
  id: 'new-provider',
  name: 'New Provider',
  models: [/* model configs */],
  capabilities: [/* capabilities */],
  costPerToken: { input: 0.001, output: 0.002 },
  rateLimits: { requestsPerMinute: 60, tokensPerMinute: 100000 }
};

// Add to initializeProviders()
this.providers.set('new-provider', newProvider);
```

2. **Implement generation method**:
```typescript
private async generateNewProviderResponse(
  request: ModelRequest, 
  modelConfig: ModelConfig
): Promise<ModelResponse> {
  // Implement provider-specific logic
  // Map roles, handle streaming, count tokens
  // Return standardized ModelResponse
}
```

3. **Update route handler**:
```typescript
case 'new-provider':
  return await this.generateNewProviderResponse(request, modelConfig);
```

### Current Model Support
- ✅ **Gemini**: Fully implemented with context integration
- 🚧 **GPT**: Framework ready, needs API integration
- 🚧 **Claude**: Framework ready, needs API integration

## 🛠️ API Reference

### Memory Management Endpoints

#### GET /api/memory/stats
Returns memory usage statistics and effectiveness metrics.

**Response**:
```json
{
  "totalMemories": 247,
  "storageMB": 12.3,
  "effectivenessPercent": 87,
  "monthlyActivity": {
    "created": 43,
    "retrieved": 127,
    "summarized": 18
  }
}
```

#### GET /api/memory/search?q={query}&limit={limit}
Search across all memory types with relevance scoring.

**Parameters**:
- `q`: Search query (required)
- `limit`: Max results (default: 20)
- `type`: Filter by type: 'semantic', 'episodic' (optional)

**Response**:
```json
{
  "results": [
    {
      "id": "mem_123",
      "type": "semantic",
      "content": "User prefers dark mode interface",
      "createdAt": "2025-01-15T10:30:00Z",
      "score": 0.85
    }
  ],
  "totalCount": 5,
  "query": "dark mode",
  "type": "all"
}
```

#### POST /api/memory/toggle
Enable/disable memory types for the user.

**Request Body**:
```json
{
  "master": true,
  "shortTerm": true, 
  "longTerm": true,
  "episodic": false
}
```

**Response**:
```json
{
  "memoryEnabled": true,
  "shortTermMemoryEnabled": true,
  "semanticMemoryEnabled": true,
  "episodicMemoryEnabled": false
}
```

#### POST /api/memory/export
Export all user memories as downloadable JSON.

**Response**:
```json
{
  "success": true,
  "downloadFilename": "pixtorai-memories-user123-2025-01-15.json",
  "data": {
    "exportDate": "2025-01-15T10:30:00Z",
    "userId": "user123",
    "memories": {/* all memory data */}
  }
}
```

#### DELETE /api/memory/clear
Permanently delete all user memories.

**Request Body**:
```json
{
  "confirmToken": "CONFIRM_DELETE_ALL_MEMORIES"
}
```

**Response**:
```json
{
  "success": true,
  "clearedCount": 247,
  "message": "All memories have been permanently deleted"
}
```

#### POST /api/memory/context
Generate conversation context for model requests.

**Request Body**:
```json
{
  "conversationId": "conv_123",
  "currentPrompt": "What were we discussing about the API design?",
  "maxTokens": 8000
}
```

**Response**:
```json
{
  "context": "SYSTEM: You are Pixtorai...\n\nKNOWN FACTS:\n- User prefers REST APIs...",
  "tokenCount": 1847,
  "remainingTokens": 6153,
  "components": {
    "systemPrompt": true,
    "shortTerm": true,
    "semantic": 3,
    "episodic": 1
  }
}
```

## 🚀 Deployment Guide

### Prerequisites
1. Firebase project with Firestore enabled
2. Environment variables configured:
   - `GEMINI_API_KEY`
   - Firebase configuration
   - Stripe keys (for subscription features)

### Deployment Steps
1. **Build Functions**:
   ```bash
   cd functions
   npm run build
   ```

2. **Deploy to Firebase**:
   ```bash
   firebase deploy --only functions,hosting
   ```

3. **Verify Deployment**:
   - Test `/api/memory/stats` endpoint
   - Check Firebase Functions logs
   - Verify Memory Management UI loads

### Environment Configuration
```bash
# Firebase Functions Environment
firebase functions:config:set \
  gemini.api_key="your-gemini-key" \
  --project your-project-id
```

## 🧪 Testing & Verification

### Acceptance Test Scenarios

#### 1. Context Continuity Test
```
User: "My name is Umer and I work as a software engineer"
Assistant: [Saves semantic memory]

[After 10+ turns]
User: "What's my profession again?"
Assistant: "You work as a software engineer" [Uses semantic memory]
```

#### 2. Model Switch Test
```
Conversation on Gemini:
User: "I prefer dark themes"
Assistant: [Memory saved]

Switch to GPT/Claude:
User: "Apply my preferred theme"
Assistant: [Retrieves dark theme preference from memory]
```

#### 3. Privacy Control Test
```
User disables long-term memory → No new semantic memories created
User exports memories → Downloads complete JSON file
User clears memories → All memories permanently deleted
```

#### 4. Token Budget Test
```
Long conversation with many memories:
- Context stays under 70% of input tokens
- Most relevant memories prioritized
- No "context length exceeded" errors
```

## 📊 Monitoring & Maintenance

### Key Metrics to Monitor
- **Memory Effectiveness Score**: % of retrieved memories used in responses
- **Context Token Usage**: Average % of token budget used
- **Memory Growth Rate**: New memories created per day
- **Search Performance**: Average retrieval time
- **Error Rates**: Failed memory operations

### Performance Optimization
1. **Embedding Optimization**: Use efficient vector search
2. **Memory Pruning**: Remove low-importance memories automatically
3. **Context Caching**: Cache frequently accessed contexts
4. **Token Optimization**: Compress memory representations

### Troubleshooting Common Issues

#### Memory Not Working
1. Check user memory settings: `GET /api/memory/stats`
2. Verify Firebase Functions deployment
3. Check authentication tokens
4. Review Firebase Functions logs

#### High Token Usage
1. Reduce memory retrieval limits
2. Implement memory importance filtering
3. Compress episodic summaries
4. Optimize semantic memory storage

#### Slow Response Times
1. Implement memory caching
2. Optimize vector search indices
3. Reduce memory retrieval scope
4. Use async memory operations

## 🔐 Security & Privacy

### Data Protection
- All memories encrypted at rest (Firebase default)
- User-controlled memory toggles
- GDPR-compliant export/deletion
- No cross-user memory access

### Privacy Controls
- Master memory toggle (disables all memory)
- Granular memory type controls
- Automatic memory expiration (configurable)
- Audit logs for memory operations

### Compliance Features
- Data export in standard formats
- Complete memory deletion capability
- User consent tracking
- Transparency in memory usage

## 🔄 Future Enhancements

### Planned Features
1. **Advanced Vector Search**: Implement proper embedding similarity
2. **Memory Clustering**: Group related memories automatically  
3. **Cross-Conversation Memory**: Share memories across conversations
4. **Memory Analytics**: Usage patterns and effectiveness insights
5. **Smart Summarization**: AI-powered conversation summarization

### Scalability Considerations
- Implement memory sharding for large user bases
- Add memory compression for storage efficiency
- Implement background memory processing
- Add memory backup and recovery systems

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-09  
**Maintainer**: Claude AI Assistant  
**Status**: Production Ready