"use strict";
// Memory-Enhanced Image Generation with Context Integration
// Integrates conversation memory for continuous context across model calls
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
exports.memoryEnhancedGenerate = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const generative_ai_1 = require("@google/generative-ai");
const busboy = require('busboy');
// Authentication helper
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
// Memory context builder
const buildMemoryContext = async (userId, conversationId, prompt) => {
    var _a;
    const db = admin.firestore();
    try {
        console.log(`Building memory context for user: ${userId}, conversation: ${conversationId}`);
        // System prompt for Pixtorai
        const systemPrompt = `You are Pixtorai, a helpful multi-turn AI assistant.
Use "Known Facts" (retrieved memories), conversation summaries, and recent turns to maintain continuity. Prefer recent preferences over older ones. If context is missing, ask a brief clarifying question. Respect privacy: do not reveal hidden memories unless the user asks. Be clear, concise, and conversational; naturally reference prior context without repeating it verbatim.`;
        // Get user's memory settings
        const settingsDoc = await db.collection('memorySettings').doc(userId).get();
        const memoryEnabled = settingsDoc.exists ? (_a = settingsDoc.data()) === null || _a === void 0 ? void 0 : _a.memoryEnabled : true;
        if (!memoryEnabled) {
            return {
                systemPrompt,
                knownFacts: [],
                conversationHistory: [],
                recentMessages: []
            };
        }
        // Get semantic memories (known facts)
        const semanticSnapshot = await db.collection('semanticMemories')
            .where('userId', '==', userId)
            .orderBy('importance', 'desc')
            .limit(5)
            .get();
        const knownFacts = semanticSnapshot.docs
            .map(doc => doc.data().content)
            .filter(content => content && typeof content === 'string');
        // Get episodic memories (conversation summaries)
        const episodicSnapshot = await db.collection('episodicMemories')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(2)
            .get();
        const conversationHistory = episodicSnapshot.docs
            .map(doc => doc.data().summary)
            .filter(summary => summary && typeof summary === 'string');
        // Get short-term memory (recent messages)
        const shortTermDoc = await db.collection('shortTermMemories')
            .doc(`${conversationId}_${userId}`)
            .get();
        let recentMessages = [];
        if (shortTermDoc.exists) {
            const shortTermData = shortTermDoc.data();
            recentMessages = ((shortTermData === null || shortTermData === void 0 ? void 0 : shortTermData.messages) || [])
                .slice(-6) // Last 6 messages
                .map((msg) => ({
                role: msg.role,
                content: msg.content
            }));
        }
        console.log(`Memory context built: ${knownFacts.length} facts, ${conversationHistory.length} summaries, ${recentMessages.length} recent messages`);
        return {
            systemPrompt,
            knownFacts,
            conversationHistory,
            recentMessages
        };
    }
    catch (error) {
        console.error('Error building memory context:', error);
        return {
            systemPrompt: `You are Pixtorai, a helpful multi-turn AI assistant.`,
            knownFacts: [],
            conversationHistory: [],
            recentMessages: []
        };
    }
};
// Build contextual prompt with memory
const buildContextualPrompt = (context, userPrompt, mode) => {
    const parts = [];
    // Add system prompt
    parts.push(`SYSTEM: ${context.systemPrompt}`);
    // Add known facts if available
    if (context.knownFacts.length > 0) {
        parts.push(`KNOWN FACTS:\n${context.knownFacts.map(fact => `- ${fact}`).join('\n')}`);
    }
    // Add conversation history if available
    if (context.conversationHistory.length > 0) {
        parts.push(`CONVERSATION HISTORY:\n${context.conversationHistory.map(summary => `Previous conversation: ${summary}`).join('\n\n')}`);
    }
    // Add recent messages if available
    if (context.recentMessages.length > 0) {
        const recentChat = context.recentMessages
            .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
            .join('\n');
        parts.push(`RECENT CONVERSATION:\n${recentChat}`);
    }
    // Add mode-specific instructions
    if (mode === 'photo' || mode === 'image') {
        parts.push(`MODE: Focus on image generation, editing, or visual analysis tasks. Be creative and detailed in visual descriptions.`);
    }
    else if (mode === 'chat') {
        parts.push(`MODE: Engage in natural conversation, maintaining context and personality.`);
    }
    // Add current user prompt
    parts.push(`USER: ${userPrompt}`);
    return parts.join('\n\n');
};
// Save conversation to memory
const saveToMemory = async (userId, conversationId, userPrompt, response, mode) => {
    const db = admin.firestore();
    try {
        // Save to short-term memory
        const shortTermRef = db.collection('shortTermMemories').doc(`${conversationId}_${userId}`);
        const shortTermDoc = await shortTermRef.get();
        const timestamp = admin.firestore.Timestamp.now();
        const userMessage = {
            messageId: `msg_${Date.now()}_user`,
            content: userPrompt,
            role: 'user',
            modelProvider: 'gemini',
            timestamp,
            importance: 0.7
        };
        const assistantMessage = {
            messageId: `msg_${Date.now()}_assistant`,
            content: response,
            role: 'assistant',
            modelProvider: 'gemini',
            timestamp,
            importance: 0.6
        };
        if (shortTermDoc.exists) {
            // Update existing short-term memory
            const data = shortTermDoc.data();
            const messages = (data === null || data === void 0 ? void 0 : data.messages) || [];
            // Add new messages and keep only last 12
            messages.push(userMessage, assistantMessage);
            const recentMessages = messages.slice(-12);
            await shortTermRef.update({
                messages: recentMessages,
                updatedAt: timestamp
            });
        }
        else {
            // Create new short-term memory
            await shortTermRef.set({
                id: `${conversationId}_${userId}`,
                conversationId,
                userId,
                messages: [userMessage, assistantMessage],
                windowSize: 12,
                createdAt: timestamp,
                updatedAt: timestamp
            });
        }
        // Extract and save semantic memories from user input if it contains important information
        const importantPatterns = [
            /my name is|i am|i work|i live/i,
            /i like|i prefer|i enjoy|i love/i,
            /remember|important|note/i
        ];
        const hasImportantInfo = importantPatterns.some(pattern => pattern.test(userPrompt));
        if (hasImportantInfo) {
            const semanticRef = db.collection('semanticMemories').doc();
            await semanticRef.set({
                id: semanticRef.id,
                userId,
                conversationId,
                content: userPrompt,
                embedding: [], // Would generate actual embedding in production
                category: 'preference',
                keywords: userPrompt.toLowerCase().split(' ').filter(word => word.length > 3),
                importance: 0.8,
                confidence: 0.9,
                createdAt: timestamp,
                lastAccessedAt: timestamp,
                accessCount: 1,
                relatedMemoryIds: [],
                sourceMessageIds: [userMessage.messageId],
                privacyLevel: 'full'
            });
        }
        console.log(`Saved conversation to memory: ${conversationId}`);
    }
    catch (error) {
        console.error('Error saving to memory:', error);
        // Don't throw - memory saving shouldn't block the response
    }
};
// Main memory-enhanced generate function
const memoryEnhancedGenerate = async (request, response) => {
    console.log(`🧠 MEMORY-ENHANCED Generate called: ${request.method}`);
    if (request.method !== 'POST') {
        response.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        // Verify authentication
        const userId = await verifyAuth(request);
        if (!userId) {
            response.status(401).json({ error: 'Unauthorized' });
            return;
        }
        console.log(`Authenticated user: ${userId}`);
        // Parse multipart form data
        const bb = busboy({ headers: request.headers });
        let prompt = '';
        let mode = 'chat';
        let conversationId = `conv_${Date.now()}`;
        const files = [];
        const parsePromise = new Promise((resolve, reject) => {
            bb.on('field', (fieldname, val) => {
                console.log(`Field [${fieldname}]: ${val}`);
                if (fieldname === 'prompt')
                    prompt = val;
                if (fieldname === 'mode')
                    mode = val;
                if (fieldname === 'conversationId')
                    conversationId = val;
            });
            bb.on('file', (fieldname, file) => {
                console.log(`File field: ${fieldname}`);
                const chunks = [];
                file.on('data', (chunk) => chunks.push(chunk));
                file.on('end', () => {
                    if (chunks.length > 0) {
                        files.push(Buffer.concat(chunks));
                    }
                });
            });
            bb.on('finish', () => resolve());
            bb.on('error', (error) => reject(error));
        });
        request.pipe(bb);
        await parsePromise;
        if (!prompt) {
            response.status(400).json({ error: 'Prompt is required' });
            return;
        }
        console.log(`Processing prompt: "${prompt.substring(0, 100)}..." in ${mode} mode`);
        // Build memory context
        const memoryContext = await buildMemoryContext(userId, conversationId, prompt);
        // Build contextual prompt with memory
        const contextualPrompt = buildContextualPrompt(memoryContext, prompt, mode);
        console.log(`Built contextual prompt with ${contextualPrompt.length} characters`);
        // Initialize Gemini client
        const apiKey = functions.config().gemini.api_key;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        // Select appropriate model based on mode
        const modelName = mode === 'photo' || mode === 'image'
            ? 'gemini-2.5-flash-image-preview'
            : 'gemini-2.0-flash-exp';
        const model = genAI.getGenerativeModel({ model: modelName });
        console.log(`Using model: ${modelName}`);
        // Prepare content parts
        const parts = [{ text: contextualPrompt }];
        // Add images if provided and model supports them
        if (files.length > 0 && modelName.includes('image')) {
            for (const fileBuffer of files) {
                const base64 = fileBuffer.toString('base64');
                parts.push({
                    inlineData: {
                        mimeType: 'image/jpeg', // Assuming JPEG for now
                        data: base64
                    }
                });
                console.log(`Added image to prompt (${fileBuffer.length} bytes)`);
            }
        }
        // Generate response
        const startTime = Date.now();
        const result = await model.generateContent(parts);
        const responseText = result.response.text();
        const processingTime = Date.now() - startTime;
        console.log(`Generated response in ${processingTime}ms: "${responseText.substring(0, 100)}..."`);
        // Save to memory (async, don't wait)
        saveToMemory(userId, conversationId, prompt, responseText, mode).catch(error => {
            console.error('Background memory save error:', error);
        });
        // Return response with memory metadata
        response.status(200).json({
            success: true,
            response: responseText,
            model: modelName,
            provider: 'gemini',
            processingTimeMs: processingTime,
            memoryUsed: {
                knownFacts: memoryContext.knownFacts.length,
                conversationHistory: memoryContext.conversationHistory.length,
                recentMessages: memoryContext.recentMessages.length
            },
            conversationId,
            contextLength: contextualPrompt.length
        });
    }
    catch (error) {
        console.error('Memory-enhanced generation error:', error);
        response.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Generation failed',
            model: 'error',
            provider: 'gemini'
        });
    }
};
exports.memoryEnhancedGenerate = memoryEnhancedGenerate;
//# sourceMappingURL=memory-enhanced-generate.js.map