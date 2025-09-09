"use strict";
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
exports.generateImage = void 0;
const functions = __importStar(require("firebase-functions"));
const generative_ai_1 = require("@google/generative-ai");
const busboy = require('busboy');
function getGenAI() {
    var _a;
    const config = functions.config();
    return new generative_ai_1.GoogleGenerativeAI(((_a = config.gemini) === null || _a === void 0 ? void 0 : _a.api_key) || '');
}
// Removed keyword-based detection - now using explicit mode parameter from frontend
const generateImage = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        console.log('🔍 Content-Type:', req.headers['content-type']);
        console.log('🔍 Request method:', req.method);
        console.log('🔍 Raw body available:', !!req.body);
        console.log('🔍 Raw body:', req.body);
        console.log('🔍 Raw body keys:', req.body ? Object.keys(req.body) : 'no body');
        // For now, let's just handle text prompts (no file uploads)
        // This bypasses the multer issues entirely
        const contentType = req.headers['content-type'] || '';
        const isMultipartRequest = contentType.includes('multipart/form-data');
        if (isMultipartRequest) {
            console.log('⚠️ Multipart form data detected - parsing with multer');
            console.log('📝 BEFORE multer - req.body:', req.body);
            console.log('📁 BEFORE multer - req.files:', req.files);
            // Try to extract data directly without multer first
            console.log('📝 Trying direct form data extraction');
            console.log('📝 Raw req.body:', req.body);
            console.log('📝 Raw req.body type:', typeof req.body);
            console.log('📝 Raw req.body.prompt:', (_a = req.body) === null || _a === void 0 ? void 0 : _a.prompt);
            console.log('📝 Raw req.body.get:', typeof ((_b = req.body) === null || _b === void 0 ? void 0 : _b.get));
            let prompt = ((_c = req.body) === null || _c === void 0 ? void 0 : _c.prompt) || ((_e = (_d = req.body) === null || _d === void 0 ? void 0 : _d.get) === null || _e === void 0 ? void 0 : _e.call(_d, 'prompt'));
            let mode = ((_f = req.body) === null || _f === void 0 ? void 0 : _f.mode) || ((_h = (_g = req.body) === null || _g === void 0 ? void 0 : _g.get) === null || _h === void 0 ? void 0 : _h.call(_g, 'mode')) || 'chat';
            console.log('📋 Direct extraction - prompt:', prompt);
            console.log('🎯 Direct extraction - mode:', mode);
            if (!prompt) {
                console.log('⚠️ No prompt found in direct extraction, trying busboy...');
                try {
                    // Use busboy to parse the raw buffer directly
                    const fields = {};
                    const files = [];
                    const contentType = req.headers['content-type'];
                    const busboyInstance = busboy({ headers: { 'content-type': contentType } });
                    busboyInstance.on('field', (fieldname, val) => {
                        console.log('📝 Busboy field:', fieldname, '=', val);
                        fields[fieldname] = val;
                    });
                    busboyInstance.on('file', (fieldname, file, info) => {
                        console.log('📁 Busboy file:', fieldname, info);
                        const buffers = [];
                        file.on('data', (data) => buffers.push(data));
                        file.on('end', () => {
                            files.push({
                                fieldname,
                                originalname: info.filename,
                                mimetype: info.mimeType,
                                buffer: Buffer.concat(buffers)
                            });
                        });
                    });
                    await new Promise((resolve, reject) => {
                        busboyInstance.on('finish', () => {
                            console.log('📝 Busboy finished - fields:', fields);
                            console.log('📁 Busboy finished - files:', files.length);
                            resolve();
                        });
                        busboyInstance.on('error', (err) => {
                            console.error('Busboy error:', err);
                            reject(err);
                        });
                        // Write the raw buffer to busboy
                        busboyInstance.write(req.body);
                        busboyInstance.end();
                    });
                    prompt = fields.prompt || 'Generate a beautiful AI artwork';
                    mode = fields.mode || 'chat';
                    console.log('🎨 Using prompt after busboy:', prompt);
                    console.log('🎯 Using mode after busboy:', mode);
                    console.log('📁 Files parsed:', files.length);
                    await processImageGeneration({ body: { prompt, mode }, files: files, isMultipartRequest: true }, res);
                }
                catch (busboyError) {
                    console.error('Error parsing multipart data:', busboyError);
                    // Fallback: use whatever was extracted directly or default
                    prompt = prompt || 'Generate a beautiful AI artwork';
                    mode = mode || 'chat';
                    console.log('🔄 Fallback after multer error - prompt:', prompt);
                    console.log('🔄 Fallback after multer error - mode:', mode);
                    await processImageGeneration({ body: { prompt, mode }, files: [], isMultipartRequest: true }, res);
                }
            }
            else {
                // We got the prompt directly, no need for multer
                console.log('✅ Got prompt directly, skipping multer');
                prompt = prompt || 'Generate a beautiful AI artwork';
                await processImageGeneration({ body: { prompt, mode }, files: [], isMultipartRequest: true }, res);
            }
        }
        else if (contentType.includes('application/json')) {
            console.log('📝 Processing JSON request');
            await processImageGeneration(req, res);
        }
        else {
            console.log('❌ Unsupported content type:', contentType);
            console.log('🔄 Trying with default prompt anyway');
            // Fallback - try to process with a default prompt
            const prompt = 'Generate a beautiful AI artwork';
            await processImageGeneration({ body: { prompt }, files: [] }, res);
        }
    }
    catch (error) {
        console.error('Request handling error:', error);
        // Ensure we always send a response
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Request handling failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
};
exports.generateImage = generateImage;
async function processImageGeneration(req, res) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        console.log('🔥 === ENTERING processImageGeneration ===');
        console.log('📝 Request body keys:', Object.keys(req.body || {}));
        console.log('📝 Full request body:', req.body);
        console.log('📁 Files received:', req.files ? req.files.length : 0);
        console.log('📋 Body prompt:', (_a = req.body) === null || _a === void 0 ? void 0 : _a.prompt);
        console.log('🎯 Mode:', (_b = req.body) === null || _b === void 0 ? void 0 : _b.mode);
        const prompt = ((_c = req.body) === null || _c === void 0 ? void 0 : _c.prompt) || 'Generate a beautiful AI artwork';
        const files = req.files || [];
        const mode = ((_d = req.body) === null || _d === void 0 ? void 0 : _d.mode) || 'chat'; // Default to chat mode for safety
        const isMultipartRequest = req.isMultipartRequest || false;
        const conversationHistory = ((_e = req.body) === null || _e === void 0 ? void 0 : _e.conversationHistory) || [];
        if (!prompt && files.length === 0) {
            res.status(400).json({
                error: 'Please provide a prompt or upload images'
            });
            return;
        }
        // Determine which model to use based on explicit mode from frontend
        // Force image generation if it's a multipart request (file upload attempt)
        const shouldGenerateImage = mode === 'photo' || files.length > 0 || isMultipartRequest;
        console.log('🔍 DEBUG - Mode value:', `"${mode}"`);
        console.log('🔍 DEBUG - Mode type:', typeof mode);
        console.log('🔍 DEBUG - Mode === "photo":', mode === 'photo');
        console.log('🔍 DEBUG - Mode === "chat":', mode === 'chat');
        console.log('🔍 DEBUG - Files length:', files.length);
        console.log('🔍 DEBUG - Files array:', files);
        console.log('🔍 DEBUG - Is multipart request:', isMultipartRequest);
        console.log('🔍 DEBUG - Condition mode === "photo":', mode === 'photo');
        console.log('🔍 DEBUG - Condition files.length > 0:', files.length > 0);
        console.log('🔍 DEBUG - Condition isMultipartRequest:', isMultipartRequest);
        console.log('🤖 Should generate image:', shouldGenerateImage, 'Mode:', mode, 'Has files:', files.length > 0, 'Is multipart:', isMultipartRequest);
        if (shouldGenerateImage) {
            // Use Gemini for image generation with the latest model
            let finalImageUrl = '';
            const description = prompt || 'Generate an image';
            console.log('🎨 Starting image generation with prompt:', description);
            // Try image generation first
            try {
                // Use Gemini 2.5 Flash Image for actual image generation
                let finalImageUrl = '';
                let modelUsed = 'gemini-2.5-flash-image-preview';
                try {
                    const genAI = getGenAI();
                    console.log('🔑 Checking Gemini API key availability:', !!genAI);
                    // Use Gemini 2.5 Flash Image for actual image generation
                    const modelName = 'gemini-2.5-flash-image-preview';
                    console.log(`🤖 Using model: ${modelName}`);
                    const imageModel = genAI.getGenerativeModel({ model: modelName });
                    let contents;
                    if (files.length > 0) {
                        const parts = [];
                        parts.push({
                            text: `Edit this image: ${description}. Create a high-quality, detailed result.`
                        });
                        for (const file of files) {
                            const base64Data = file.buffer.toString('base64');
                            parts.push({
                                inlineData: {
                                    mimeType: file.mimetype,
                                    data: base64Data
                                }
                            });
                        }
                        contents = parts;
                    }
                    else {
                        contents = [{ text: `Generate a high-quality, detailed image: ${description}` }];
                    }
                    const imageResult = await imageModel.generateContent({
                        contents: [{ role: 'user', parts: contents }],
                        generationConfig: {
                            maxOutputTokens: 8192,
                            temperature: 0.8
                        }
                    });
                    const imageResponse = await imageResult.response;
                    const candidates = imageResponse.candidates;
                    if (candidates && candidates.length > 0) {
                        const candidate = candidates[0];
                        // Check for content policy violations
                        if (candidate.finishReason === 'RECITATION') {
                            res.status(400).json({
                                error: 'Content policy violation: The request contains content that may violate usage policies.',
                                isImageGeneration: true
                            });
                            return;
                        }
                        if (candidate.finishReason === 'SAFETY') {
                            res.status(400).json({
                                error: 'Safety filter triggered: The content was flagged by safety filters.',
                                isImageGeneration: true
                            });
                            return;
                        }
                        const parts = (_f = candidate.content) === null || _f === void 0 ? void 0 : _f.parts;
                        if (parts) {
                            for (const part of parts) {
                                // Check for inline_data with image
                                if (part.inlineData && ((_g = part.inlineData.mimeType) === null || _g === void 0 ? void 0 : _g.startsWith('image/'))) {
                                    const base64Image = part.inlineData.data;
                                    const mimeType = part.inlineData.mimeType;
                                    finalImageUrl = `data:${mimeType};base64,${base64Image}`;
                                    console.log('✅ Found generated image in response');
                                    break;
                                }
                            }
                        }
                    }
                }
                catch (geminiError) {
                    console.log('⚠️ Gemini image generation failed:', geminiError.message);
                    console.log('Full error:', geminiError);
                }
                // If no image was generated, use fallback
                if (!finalImageUrl) {
                    console.log('🔄 Using fallback image service');
                    // Fallback to external service
                    const cleanPrompt = (prompt || description || 'AI generated artwork')
                        .replace(/[^a-zA-Z0-9\s]/g, '')
                        .substring(0, 100);
                    const imagePrompt = encodeURIComponent(cleanPrompt);
                    const seed = Math.floor(Math.random() * 10000);
                    finalImageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?seed=${seed}&width=512&height=512&nologo=true`;
                }
                res.json({
                    imageUrl: finalImageUrl,
                    success: true,
                    modelUsed: modelUsed,
                    isImageGeneration: true,
                    originalImages: files.length > 0 ? files.map((file) => {
                        const base64 = file.buffer.toString('base64');
                        return `data:${file.mimetype};base64,${base64}`;
                    }) : undefined
                });
                return;
            }
            catch (error) {
                console.error('Image generation error:', error);
                // Fallback to external service on any error
                console.log('🔄 Using fallback image service due to error');
                const cleanPrompt = (prompt || 'AI generated artwork')
                    .replace(/[^a-zA-Z0-9\s]/g, '')
                    .substring(0, 100);
                const imagePrompt = encodeURIComponent(cleanPrompt);
                const seed = Math.floor(Math.random() * 10000);
                finalImageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?seed=${seed}&width=512&height=512&nologo=true`;
                res.json({
                    imageUrl: finalImageUrl,
                    success: true,
                    modelUsed: 'pollinations-fallback',
                    isImageGeneration: true,
                    originalImages: files.length > 0 ? files.map((file) => {
                        const base64 = file.buffer.toString('base64');
                        return `data:${file.mimetype};base64,${base64}`;
                    }) : undefined
                });
                return;
            }
        }
        else {
            // Use regular chat model for text-only conversations
            console.log('📝 ENTERING TEXT CHAT MODE - using gemini-2.0-flash-exp');
            console.log('📝 Text chat prompt:', prompt);
            console.log('📝 Conversation history length:', conversationHistory.length);
            console.log('📝 Conversation history sample:', JSON.stringify(conversationHistory.slice(-2), null, 2)); // Show last 2 messages for debugging
            const genAI = getGenAI();
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp'
            });
            let result;
            if (conversationHistory.length > 0) {
                // Multi-turn conversation with history
                console.log('📝 Using multi-turn conversation with history');
                // Create conversation contents by combining history with current prompt
                const contents = [
                    ...conversationHistory,
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ];
                console.log('📝 Total conversation turns:', contents.length);
                result = await model.generateContent({
                    contents: contents
                });
            }
            else {
                // Single-turn conversation (first message)
                console.log('📝 Using single-turn conversation (first message)');
                result = await model.generateContent(prompt);
            }
            const response = await result.response;
            const text = response.text();
            console.log('📝 Text chat response:', text.substring(0, 100) + '...');
            res.json({
                text: text,
                success: true,
                modelUsed: 'gemini-2.0-flash-exp',
                isImageGeneration: false
            });
            return;
        }
    }
    catch (error) {
        console.error('Error processing request:', error);
        // Ensure we always send a response
        if (!res.headersSent) {
            res.status(500).json({
                error: error.message || 'Failed to process request',
                details: error.stack || 'No stack trace available'
            });
        }
        return;
    }
}
//# sourceMappingURL=generate-image.js.map