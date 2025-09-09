// Memory Management API endpoints for Firebase Functions
// Provides backend integration for cross-model conversational memory

import * as admin from 'firebase-admin';
import { Request, Response } from 'firebase-functions';

// Initialize services (these will be imported from client-side when available server-side)
const db = admin.firestore();

// Authentication middleware
const verifyAuth = async (request: Request): Promise<string | null> => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
};

// API: GET /memory/stats - Get memory usage statistics
export const memoryStats = async (request: Request, response: Response): Promise<void> => {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(`Getting memory stats for user: ${userId}`);

    // Get semantic memories count
    const semanticSnapshot = await db.collection('semanticMemories')
      .where('userId', '==', userId)
      .get();

    // Get episodic memories count
    const episodicSnapshot = await db.collection('episodicMemories')
      .where('userId', '==', userId)
      .get();

    // Get short-term memories count (approximate)
    const shortTermSnapshot = await db.collection('shortTermMemories')
      .where('userId', '==', userId)
      .get();

    // Calculate storage estimates
    const semanticCount = semanticSnapshot.size;
    const episodicCount = episodicSnapshot.size;
    const shortTermMessages = shortTermSnapshot.docs.reduce((total, doc) => {
      const data = doc.data();
      return total + (data.messages?.length || 0);
    }, 0);

    // Storage calculations (rough estimates)
    const semanticStorageBytes = semanticCount * 2000; // ~2KB per semantic memory
    const episodicStorageBytes = episodicCount * 5000; // ~5KB per episode
    const embeddingStorageBytes = (semanticCount + episodicCount) * 3072; // 768 floats * 4 bytes
    const totalStorage = semanticStorageBytes + episodicStorageBytes + embeddingStorageBytes;

    // Calculate effectiveness score (simplified)
    let effectivenessScore = 50; // Base score
    if (semanticCount > 10) effectivenessScore += 20;
    if (episodicCount > 5) effectivenessScore += 15;
    if (shortTermMessages > 20) effectivenessScore += 15;

    // Monthly activity (simplified - would track actual usage in production)
    const monthlyActivity = {
      created: Math.floor(semanticCount / 3), // Estimate
      retrieved: Math.floor(semanticCount * 2), // Estimate
      summarized: episodicCount
    };

    const stats = {
      totalMemories: semanticCount + episodicCount,
      storageMB: Math.round(totalStorage / (1024 * 1024) * 100) / 100,
      effectivenessPercent: Math.min(effectivenessScore, 100),
      monthlyActivity
    };

    response.status(200).json(stats);

  } catch (error) {
    console.error('Error getting memory stats:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};

// API: GET /memory/search - Search memories
export const memorySearch = async (request: Request, response: Response): Promise<void> => {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query = request.query.q as string;
    const type = request.query.type as string;
    const limit = parseInt(request.query.limit as string) || 20;

    console.log(`Searching memories for user: ${userId}, query: ${query}, type: ${type}`);

    if (!query || query.length < 2) {
      response.status(400).json({ error: 'Query must be at least 2 characters' });
      return;
    }

    const results: any[] = [];

    // Search semantic memories (simple text search for now)
    if (!type || type === 'semantic' || type === 'long') {
      const semanticQuery = db.collection('semanticMemories')
        .where('userId', '==', userId)
        .limit(Math.floor(limit / 2));

      const semanticSnapshot = await semanticQuery.get();
      
      semanticSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Simple text matching (would use vector search in production)
        if (data.content?.toLowerCase().includes(query.toLowerCase()) ||
            data.keywords?.some((keyword: string) => keyword.toLowerCase().includes(query.toLowerCase()))) {
          results.push({
            id: doc.id,
            type: 'semantic',
            content: data.content,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            score: 0.8 // Mock similarity score
          });
        }
      });
    }

    // Search episodic memories
    if (!type || type === 'episodic') {
      const episodicQuery = db.collection('episodicMemories')
        .where('userId', '==', userId)
        .limit(Math.floor(limit / 2));

      const episodicSnapshot = await episodicQuery.get();
      
      episodicSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Simple text matching
        if (data.summary?.toLowerCase().includes(query.toLowerCase()) ||
            data.keyTopics?.some((topic: string) => topic.toLowerCase().includes(query.toLowerCase()))) {
          results.push({
            id: doc.id,
            type: 'episodic',
            content: data.summary,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            score: 0.7 // Mock similarity score
          });
        }
      });
    }

    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);

    response.status(200).json({
      results: limitedResults,
      totalCount: limitedResults.length,
      query,
      type: type || 'all'
    });

  } catch (error) {
    console.error('Error searching memories:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};

// API: POST /memory/toggle - Toggle memory settings
export const memoryToggle = async (request: Request, response: Response): Promise<void> => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { master, shortTerm, longTerm, episodic } = request.body;

    console.log(`Updating memory settings for user: ${userId}`, {
      master, shortTerm, longTerm, episodic
    });

    // Get current settings
    const settingsRef = db.collection('memorySettings').doc(userId);
    const settingsDoc = await settingsRef.get();

    let currentSettings: any = {};
    if (settingsDoc.exists) {
      currentSettings = settingsDoc.data() || {};
    }

    // Update settings
    const updatedSettings = {
      ...currentSettings,
      userId,
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (master !== undefined) updatedSettings.memoryEnabled = master;
    if (shortTerm !== undefined) updatedSettings.shortTermMemoryEnabled = shortTerm;
    if (longTerm !== undefined) updatedSettings.semanticMemoryEnabled = longTerm;
    if (episodic !== undefined) updatedSettings.episodicMemoryEnabled = episodic;

    // Set defaults for new users
    if (!settingsDoc.exists) {
      updatedSettings.dataRetentionDays = 0;
      updatedSettings.allowCrossConversationMemory = true;
      updatedSettings.allowModelProviderSharing = true;
      updatedSettings.exportFormat = 'json';
      updatedSettings.memoryImportanceThreshold = 0.3;
      updatedSettings.maxSemanticMemories = 1000;
      updatedSettings.maxEpisodicMemories = 100;
      updatedSettings.preferredModelProvider = 'auto';
      updatedSettings.adaptiveModelSelection = true;
      updatedSettings.createdAt = admin.firestore.Timestamp.now();
    }

    await settingsRef.set(updatedSettings, { merge: true });

    // Return current state
    response.status(200).json({
      memoryEnabled: updatedSettings.memoryEnabled ?? true,
      shortTermMemoryEnabled: updatedSettings.shortTermMemoryEnabled ?? true,
      semanticMemoryEnabled: updatedSettings.semanticMemoryEnabled ?? true,
      episodicMemoryEnabled: updatedSettings.episodicMemoryEnabled ?? true
    });

  } catch (error) {
    console.error('Error updating memory settings:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};

// API: POST /memory/export - Export user memories
export const memoryExport = async (request: Request, response: Response): Promise<void> => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(`Exporting memories for user: ${userId}`);

    // Get all memories for the user
    const [semanticSnapshot, episodicSnapshot, shortTermSnapshot, settingsSnapshot] = await Promise.all([
      db.collection('semanticMemories').where('userId', '==', userId).get(),
      db.collection('episodicMemories').where('userId', '==', userId).get(),
      db.collection('shortTermMemories').where('userId', '==', userId).get(),
      db.collection('memorySettings').doc(userId).get()
    ]);

    // Prepare export data
    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      settings: settingsSnapshot.exists ? settingsSnapshot.data() : null,
      memories: {
        semantic: semanticSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
          lastAccessedAt: doc.data().lastAccessedAt?.toDate?.()?.toISOString()
        })),
        episodic: episodicSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
          lastAccessedAt: doc.data().lastAccessedAt?.toDate?.()?.toISOString()
        })),
        shortTerm: shortTermSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString()
        }))
      },
      summary: {
        totalSemanticMemories: semanticSnapshot.size,
        totalEpisodicMemories: episodicSnapshot.size,
        totalShortTermContexts: shortTermSnapshot.size
      }
    };

    // Return export data as JSON
    response.status(200).json({
      success: true,
      data: exportData,
      downloadFilename: `pixtorai-memories-${userId}-${new Date().toISOString().split('T')[0]}.json`
    });

  } catch (error) {
    console.error('Error exporting memories:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};

// API: DELETE /memory/clear - Clear all user memories
export const memoryClear = async (request: Request, response: Response): Promise<void> => {
  if (request.method !== 'DELETE') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { confirmToken } = request.body;

    // Require confirmation token for safety
    if (!confirmToken || confirmToken !== 'CONFIRM_DELETE_ALL_MEMORIES') {
      response.status(400).json({ 
        error: 'Invalid confirmation token',
        required: 'CONFIRM_DELETE_ALL_MEMORIES'
      });
      return;
    }

    console.log(`Clearing all memories for user: ${userId}`);

    let clearedCount = 0;

    // Delete all semantic memories
    const semanticSnapshot = await db.collection('semanticMemories')
      .where('userId', '==', userId)
      .get();

    const deletePromises: Promise<any>[] = [];

    semanticSnapshot.docs.forEach(doc => {
      deletePromises.push(doc.ref.delete());
      clearedCount++;
    });

    // Delete all episodic memories
    const episodicSnapshot = await db.collection('episodicMemories')
      .where('userId', '==', userId)
      .get();

    episodicSnapshot.docs.forEach(doc => {
      deletePromises.push(doc.ref.delete());
      clearedCount++;
    });

    // Delete all short-term memories
    const shortTermSnapshot = await db.collection('shortTermMemories')
      .where('userId', '==', userId)
      .get();

    shortTermSnapshot.docs.forEach(doc => {
      deletePromises.push(doc.ref.delete());
      clearedCount++;
    });

    // Execute all deletions
    await Promise.all(deletePromises);

    console.log(`Cleared ${clearedCount} memories for user: ${userId}`);

    response.status(200).json({
      success: true,
      clearedCount,
      message: 'All memories have been permanently deleted'
    });

  } catch (error) {
    console.error('Error clearing memories:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};

// API: POST /memory/context - Generate conversation context for model requests
export const memoryContext = async (request: Request, response: Response): Promise<void> => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { conversationId, currentPrompt, maxTokens = 8000 } = request.body;

    if (!conversationId || !currentPrompt) {
      response.status(400).json({ error: 'conversationId and currentPrompt are required' });
      return;
    }

    console.log(`Generating context for conversation: ${conversationId}`);

    // Get user's memory settings
    const settingsDoc = await db.collection('memorySettings').doc(userId).get();
    const memorySettings = settingsDoc.exists ? settingsDoc.data() : {
      memoryEnabled: true,
      shortTermMemoryEnabled: true,
      semanticMemoryEnabled: true,
      episodicMemoryEnabled: true
    };

    let contextParts: string[] = [];
    let tokenCount = 0;
    let remainingTokens = maxTokens;

    // System prompt (always included)
    const systemPrompt = `You are Pixtorai, a helpful multi-turn AI assistant.
Use "Known Facts" (retrieved memories), conversation summaries, and recent turns to maintain continuity. Prefer recent preferences over older ones. If context is missing, ask a brief clarifying question. Respect privacy: do not reveal hidden memories unless the user asks. Be clear, concise, and conversational; naturally reference prior context without repeating it verbatim.`;

    contextParts.push(`SYSTEM: ${systemPrompt}`);
    tokenCount += Math.ceil(systemPrompt.length / 4);
    remainingTokens -= tokenCount;

    // Get short-term memory (recent conversation context)
    if (memorySettings?.shortTermMemoryEnabled && remainingTokens > 0) {
      const shortTermDoc = await db.collection('shortTermMemories').doc(`${conversationId}_${userId}`).get();
      
      if (shortTermDoc.exists) {
        const shortTermData = shortTermDoc.data();
        const recentMessages = shortTermData?.messages?.slice(-10) || []; // Last 10 messages
        
        if (recentMessages.length > 0) {
          const messageContext = recentMessages.map((msg: any) => 
            `${msg.role.toUpperCase()}: ${msg.content}`
          ).join('\n');
          
          const messageTokens = Math.ceil(messageContext.length / 4);
          if (messageTokens <= remainingTokens * 0.5) { // Use max 50% for recent messages
            contextParts.push(`RECENT CONVERSATION:\n${messageContext}`);
            tokenCount += messageTokens;
            remainingTokens -= messageTokens;
          }
        }
      }
    }

    // Get relevant semantic memories (long-term facts)
    if (memorySettings?.semanticMemoryEnabled && remainingTokens > 500) {
      const semanticSnapshot = await db.collection('semanticMemories')
        .where('userId', '==', userId)
        .orderBy('importance', 'desc')
        .limit(10)
        .get();

      const relevantMemories: string[] = [];
      let semanticTokens = 0;

      semanticSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Simple relevance check (would use vector search in production)
        if (data.content?.toLowerCase().includes(currentPrompt.toLowerCase().split(' ')[0]) ||
            data.keywords?.some((keyword: string) => currentPrompt.toLowerCase().includes(keyword.toLowerCase()))) {
          const memoryText = `- ${data.content}`;
          const memoryTokens = Math.ceil(memoryText.length / 4);
          
          if (semanticTokens + memoryTokens <= remainingTokens * 0.3) { // Use max 30% for semantic memories
            relevantMemories.push(memoryText);
            semanticTokens += memoryTokens;
          }
        }
      });

      if (relevantMemories.length > 0) {
        const memoriesContext = `KNOWN FACTS:\n${relevantMemories.join('\n')}`;
        contextParts.push(memoriesContext);
        tokenCount += semanticTokens;
        remainingTokens -= semanticTokens;
      }
    }

    // Get relevant episodic memories (conversation summaries)
    if (memorySettings?.episodicMemoryEnabled && remainingTokens > 300) {
      const episodicSnapshot = await db.collection('episodicMemories')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();

      const episodicSummaries: string[] = [];
      let episodicTokens = 0;

      episodicSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const summaryText = `Previous conversation: ${data.summary}`;
        const summaryTokensCount = Math.ceil(summaryText.length / 4);
        
        if (episodicTokens + summaryTokensCount <= remainingTokens * 0.2) { // Use max 20% for episodic
          episodicSummaries.push(summaryText);
          episodicTokens += summaryTokensCount;
        }
      });

      if (episodicSummaries.length > 0) {
        const episodicContext = `CONVERSATION HISTORY:\n${episodicSummaries.join('\n\n')}`;
        contextParts.push(episodicContext);
        tokenCount += episodicTokens;
        remainingTokens -= episodicTokens;
      }
    }

    // Add current prompt
    contextParts.push(`USER: ${currentPrompt}`);
    const promptTokens = Math.ceil(currentPrompt.length / 4);
    tokenCount += promptTokens;

    // Combine all context
    const fullContext = contextParts.join('\n\n');

    response.status(200).json({
      context: fullContext,
      tokenCount,
      remainingTokens: Math.max(0, maxTokens - tokenCount),
      components: {
        systemPrompt: true,
        shortTerm: contextParts.some(part => part.startsWith('RECENT CONVERSATION')),
        semantic: contextParts.some(part => part.startsWith('KNOWN FACTS')),
        episodic: contextParts.some(part => part.startsWith('CONVERSATION HISTORY'))
      }
    });

  } catch (error) {
    console.error('Error generating memory context:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};