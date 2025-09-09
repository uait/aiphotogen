"use strict";
// Memory Management API endpoints for Firebase Functions
// Provides backend integration for cross-model conversational memory
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryContext = exports.memoryClear = exports.memoryExport = exports.memoryToggle = exports.memorySearch = exports.memoryStats = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize services (these will be imported from client-side when available server-side)
const db = admin.firestore();
// Authentication middleware
const verifyAuth = async (request) => {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        const token = authHeader.substring(7);
        const decodedToken = await admin.auth().verifyIdToken(token);
        return decodedToken.uid;
    }
    catch (error) {
        console.error('Auth verification failed:', error);
        return null;
    }
};
// API: GET /memory/stats - Get memory usage statistics
const memoryStats = async (request, response) => {
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
            var _a;
            const data = doc.data();
            return total + (((_a = data.messages) === null || _a === void 0 ? void 0 : _a.length) || 0);
        }, 0);
        // Storage calculations (rough estimates)
        const semanticStorageBytes = semanticCount * 2000; // ~2KB per semantic memory
        const episodicStorageBytes = episodicCount * 5000; // ~5KB per episode
        const embeddingStorageBytes = (semanticCount + episodicCount) * 3072; // 768 floats * 4 bytes
        const totalStorage = semanticStorageBytes + episodicStorageBytes + embeddingStorageBytes;
        // Calculate effectiveness score (simplified)
        let effectivenessScore = 50; // Base score
        if (semanticCount > 10)
            effectivenessScore += 20;
        if (episodicCount > 5)
            effectivenessScore += 15;
        if (shortTermMessages > 20)
            effectivenessScore += 15;
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
    }
    catch (error) {
        console.error('Error getting memory stats:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
};
exports.memoryStats = memoryStats;
// API: GET /memory/search - Search memories
const memorySearch = async (request, response) => {
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
        const query = request.query.q;
        const type = request.query.type;
        const limit = parseInt(request.query.limit) || 20;
        console.log(`Searching memories for user: ${userId}, query: ${query}, type: ${type}`);
        if (!query || query.length < 2) {
            response.status(400).json({ error: 'Query must be at least 2 characters' });
            return;
        }
        const results = [];
        // Search semantic memories (simple text search for now)
        if (!type || type === 'semantic' || type === 'long') {
            const semanticQuery = db.collection('semanticMemories')
                .where('userId', '==', userId)
                .limit(Math.floor(limit / 2));
            const semanticSnapshot = await semanticQuery.get();
            semanticSnapshot.docs.forEach(doc => {
                var _a, _b, _c, _d;
                const data = doc.data();
                // Simple text matching (would use vector search in production)
                if (((_a = data.content) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query.toLowerCase())) ||
                    ((_b = data.keywords) === null || _b === void 0 ? void 0 : _b.some((keyword) => keyword.toLowerCase().includes(query.toLowerCase())))) {
                    results.push({
                        id: doc.id,
                        type: 'semantic',
                        content: data.content,
                        createdAt: ((_d = (_c = data.createdAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(),
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
                var _a, _b, _c, _d;
                const data = doc.data();
                // Simple text matching
                if (((_a = data.summary) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query.toLowerCase())) ||
                    ((_b = data.keyTopics) === null || _b === void 0 ? void 0 : _b.some((topic) => topic.toLowerCase().includes(query.toLowerCase())))) {
                    results.push({
                        id: doc.id,
                        type: 'episodic',
                        content: data.summary,
                        createdAt: ((_d = (_c = data.createdAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(),
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
    }
    catch (error) {
        console.error('Error searching memories:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
};
exports.memorySearch = memorySearch;
// API: POST /memory/toggle - Toggle memory settings
const memoryToggle = async (request, response) => {
    var _a, _b, _c, _d;
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
        let currentSettings = {};
        if (settingsDoc.exists) {
            currentSettings = settingsDoc.data() || {};
        }
        // Update settings
        const updatedSettings = Object.assign(Object.assign({}, currentSettings), { userId, updatedAt: admin.firestore.Timestamp.now() });
        if (master !== undefined)
            updatedSettings.memoryEnabled = master;
        if (shortTerm !== undefined)
            updatedSettings.shortTermMemoryEnabled = shortTerm;
        if (longTerm !== undefined)
            updatedSettings.semanticMemoryEnabled = longTerm;
        if (episodic !== undefined)
            updatedSettings.episodicMemoryEnabled = episodic;
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
            memoryEnabled: (_a = updatedSettings.memoryEnabled) !== null && _a !== void 0 ? _a : true,
            shortTermMemoryEnabled: (_b = updatedSettings.shortTermMemoryEnabled) !== null && _b !== void 0 ? _b : true,
            semanticMemoryEnabled: (_c = updatedSettings.semanticMemoryEnabled) !== null && _c !== void 0 ? _c : true,
            episodicMemoryEnabled: (_d = updatedSettings.episodicMemoryEnabled) !== null && _d !== void 0 ? _d : true
        });
    }
    catch (error) {
        console.error('Error updating memory settings:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
};
exports.memoryToggle = memoryToggle;
// API: POST /memory/export - Export user memories
const memoryExport = async (request, response) => {
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
                semantic: semanticSnapshot.docs.map(doc => {
                    var _a, _b, _c, _d, _e, _f;
                    return (Object.assign(Object.assign({ id: doc.id }, doc.data()), { createdAt: (_c = (_b = (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString(), lastAccessedAt: (_f = (_e = (_d = doc.data().lastAccessedAt) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) === null || _f === void 0 ? void 0 : _f.toISOString() }));
                }),
                episodic: episodicSnapshot.docs.map(doc => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                    return (Object.assign(Object.assign({ id: doc.id }, doc.data()), { createdAt: (_c = (_b = (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString(), updatedAt: (_f = (_e = (_d = doc.data().updatedAt) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) === null || _f === void 0 ? void 0 : _f.toISOString(), lastAccessedAt: (_j = (_h = (_g = doc.data().lastAccessedAt) === null || _g === void 0 ? void 0 : _g.toDate) === null || _h === void 0 ? void 0 : _h.call(_g)) === null || _j === void 0 ? void 0 : _j.toISOString() }));
                }),
                shortTerm: shortTermSnapshot.docs.map(doc => {
                    var _a, _b, _c, _d, _e, _f;
                    return (Object.assign(Object.assign({ id: doc.id }, doc.data()), { createdAt: (_c = (_b = (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString(), updatedAt: (_f = (_e = (_d = doc.data().updatedAt) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) === null || _f === void 0 ? void 0 : _f.toISOString() }));
                })
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
    }
    catch (error) {
        console.error('Error exporting memories:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
};
exports.memoryExport = memoryExport;
// API: DELETE /memory/clear - Clear all user memories
const memoryClear = async (request, response) => {
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
        const deletePromises = [];
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
    }
    catch (error) {
        console.error('Error clearing memories:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
};
exports.memoryClear = memoryClear;
// API: POST /memory/context - Generate conversation context for model requests
const memoryContext = async (request, response) => {
    var _a;
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
        let contextParts = [];
        let tokenCount = 0;
        let remainingTokens = maxTokens;
        // System prompt (always included)
        const systemPrompt = `You are Pixtorai, a helpful multi-turn AI assistant.
Use "Known Facts" (retrieved memories), conversation summaries, and recent turns to maintain continuity. Prefer recent preferences over older ones. If context is missing, ask a brief clarifying question. Respect privacy: do not reveal hidden memories unless the user asks. Be clear, concise, and conversational; naturally reference prior context without repeating it verbatim.`;
        contextParts.push(`SYSTEM: ${systemPrompt}`);
        tokenCount += Math.ceil(systemPrompt.length / 4);
        remainingTokens -= tokenCount;
        // Get short-term memory (recent conversation context)
        if ((memorySettings === null || memorySettings === void 0 ? void 0 : memorySettings.shortTermMemoryEnabled) && remainingTokens > 0) {
            const shortTermDoc = await db.collection('shortTermMemories').doc(`${conversationId}_${userId}`).get();
            if (shortTermDoc.exists) {
                const shortTermData = shortTermDoc.data();
                const recentMessages = ((_a = shortTermData === null || shortTermData === void 0 ? void 0 : shortTermData.messages) === null || _a === void 0 ? void 0 : _a.slice(-10)) || []; // Last 10 messages
                if (recentMessages.length > 0) {
                    const messageContext = recentMessages.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n');
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
        if ((memorySettings === null || memorySettings === void 0 ? void 0 : memorySettings.semanticMemoryEnabled) && remainingTokens > 500) {
            const semanticSnapshot = await db.collection('semanticMemories')
                .where('userId', '==', userId)
                .orderBy('importance', 'desc')
                .limit(10)
                .get();
            const relevantMemories = [];
            let semanticTokens = 0;
            semanticSnapshot.docs.forEach(doc => {
                var _a, _b;
                const data = doc.data();
                // Simple relevance check (would use vector search in production)
                if (((_a = data.content) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(currentPrompt.toLowerCase().split(' ')[0])) ||
                    ((_b = data.keywords) === null || _b === void 0 ? void 0 : _b.some((keyword) => currentPrompt.toLowerCase().includes(keyword.toLowerCase())))) {
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
        if ((memorySettings === null || memorySettings === void 0 ? void 0 : memorySettings.episodicMemoryEnabled) && remainingTokens > 300) {
            const episodicSnapshot = await db.collection('episodicMemories')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(3)
                .get();
            const episodicSummaries = [];
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
    }
    catch (error) {
        console.error('Error generating memory context:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
};
exports.memoryContext = memoryContext;
//# sourceMappingURL=memory-api.js.map