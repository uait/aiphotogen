import * as functions from 'firebase-functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
const multer = require('multer');

function getGenAI() {
  const config = functions.config();
  return new GoogleGenerativeAI(config.gemini?.api_key || '');
}

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 2 // Max 2 files
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Removed keyword-based detection - now using explicit mode parameter from frontend

export const generateImage = async (req: functions.Request, res: functions.Response): Promise<void> => {
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
      console.log('📁 BEFORE multer - req.files:', (req as any).files);
      
      // Try to extract data directly without multer first
      console.log('📝 Trying direct form data extraction');
      let prompt = req.body?.prompt || req.body?.get?.('prompt');
      let mode = req.body?.mode || req.body?.get?.('mode') || 'chat';
      
      console.log('📋 Direct extraction - prompt:', prompt);
      console.log('🎯 Direct extraction - mode:', mode);
      
      if (!prompt) {
        console.log('⚠️ No prompt found in direct extraction, trying multer...');
        
        try {
          // Use multer to parse multipart form data
          const uploadMiddleware = upload.any();
          
          await new Promise<void>((resolve, reject) => {
            uploadMiddleware(req as any, res as any, (err: any) => {
              if (err) {
                console.error('Multer error:', err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
          
          // Extract prompt and mode from parsed form data
          console.log('📝 DEBUG - req.body after multer:', req.body);
          console.log('📁 DEBUG - req.files after multer:', (req as any).files);
          console.log('📋 DEBUG - req.body.prompt:', req.body?.prompt);
          console.log('🎯 DEBUG - req.body.mode:', req.body?.mode);
          
          prompt = req.body?.prompt || 'Generate a beautiful AI artwork';
          mode = req.body?.mode || 'chat';
          const files = (req as any).files || [];
          
          console.log('🎨 Using prompt after multer:', prompt);
          console.log('🎯 Using mode after multer:', mode);
          console.log('📁 Files parsed:', files.length);
          
          await processImageGeneration({ body: { prompt, mode }, files: files, isMultipartRequest: true } as any, res);
        } catch (multerError) {
          console.error('Error parsing multipart data:', multerError);
          
          // Fallback: use whatever was extracted directly or default
          prompt = prompt || 'Generate a beautiful AI artwork';
          mode = mode || 'chat';
          
          console.log('🔄 Fallback after multer error - prompt:', prompt);
          console.log('🔄 Fallback after multer error - mode:', mode);
          
          await processImageGeneration({ body: { prompt, mode }, files: [], isMultipartRequest: true } as any, res);
        }
      } else {
        // We got the prompt directly, no need for multer
        console.log('✅ Got prompt directly, skipping multer');
        prompt = prompt || 'Generate a beautiful AI artwork';
        
        await processImageGeneration({ body: { prompt, mode }, files: [], isMultipartRequest: true } as any, res);
      }
      
    } else if (contentType.includes('application/json')) {
      console.log('📝 Processing JSON request');
      await processImageGeneration(req, res);
    } else {
      console.log('❌ Unsupported content type:', contentType);
      console.log('🔄 Trying with default prompt anyway');
      
      // Fallback - try to process with a default prompt
      const prompt = 'Generate a beautiful AI artwork';
      await processImageGeneration({ body: { prompt }, files: [] } as any, res);
    }
  } catch (error) {
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

async function processImageGeneration(req: any, res: functions.Response): Promise<void> {
  try {
    console.log('🔥 === ENTERING processImageGeneration ===');
    console.log('📝 Request body keys:', Object.keys(req.body || {}));
    console.log('📝 Full request body:', req.body);
    console.log('📁 Files received:', req.files ? req.files.length : 0);
    console.log('📋 Body prompt:', req.body?.prompt);
    console.log('🎯 Mode:', req.body?.mode);
    
    const prompt = req.body?.prompt as string || 'Generate a beautiful AI artwork';
    const files = req.files || [];
    const mode = req.body?.mode as string || 'chat'; // Default to chat mode for safety
    const isMultipartRequest = req.isMultipartRequest || false;
    
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
            const parts: any[] = [];
            
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
          } else {
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
            
            const parts = candidate.content?.parts;
            if (parts) {
              for (const part of parts) {
                // Check for inline_data with image
                if ((part as any).inlineData && (part as any).inlineData.mimeType?.startsWith('image/')) {
                  const base64Image = (part as any).inlineData.data;
                  const mimeType = (part as any).inlineData.mimeType;
                  finalImageUrl = `data:${mimeType};base64,${base64Image}`;
                  console.log('✅ Found generated image in response');
                  break;
                }
              }
            }
          }
        } catch (geminiError: any) {
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
          originalImages: files.length > 0 ? files.map((file: any) => {
            const base64 = file.buffer.toString('base64');
            return `data:${file.mimetype};base64,${base64}`;
          }) : undefined
        });
        return;
        
      } catch (error: any) {
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
          originalImages: files.length > 0 ? files.map((file: any) => {
            const base64 = file.buffer.toString('base64');
            return `data:${file.mimetype};base64,${base64}`;
          }) : undefined
        });
        return;
      }
      
    } else {
      // Use regular chat model for text-only conversations
      console.log('📝 ENTERING TEXT CHAT MODE - using gemini-2.0-flash-exp');
      console.log('📝 Text chat prompt:', prompt);
      
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp'
      });
      
      const result = await model.generateContent(prompt);
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

  } catch (error: any) {
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