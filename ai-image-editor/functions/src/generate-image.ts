import * as functions from 'firebase-functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
const multer = require('multer');

function getGenAI() {
  const config = functions.config();
  return new GoogleGenerativeAI(config.gemini?.api_key || '');
}

// Multer configuration (currently unused but kept for future file upload support)
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { 
//     fileSize: 10 * 1024 * 1024, // 10MB limit
//     files: 2 // Max 2 files
//   },
//   fileFilter: (req: any, file: any, cb: any) => {
//     if (file.mimetype.startsWith('image/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only image files are allowed'));
//     }
//   }
// });

// Keywords that indicate image generation request
const IMAGE_GENERATION_KEYWORDS = [
  'generate', 'create', 'make', 'draw', 'design', 'produce',
  'image', 'picture', 'photo', 'illustration', 'artwork',
  'edit', 'modify', 'enhance', 'transform', 'change', 'add', 'remove'
];

function isImageGenerationRequest(prompt: string, hasImages: boolean): boolean {
  if (hasImages) return true;
  
  const lowerPrompt = prompt.toLowerCase();
  return IMAGE_GENERATION_KEYWORDS.some(keyword => lowerPrompt.includes(keyword));
}

export const generateImage = async (req: functions.Request, res: functions.Response): Promise<void> => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('🔍 Content-Type:', req.headers['content-type']);
    console.log('🔍 Request method:', req.method);
    console.log('🔍 Raw body available:', !!req.body);
    
    // For now, let's just handle text prompts (no file uploads)
    // This bypasses the multer issues entirely
    
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      console.log('⚠️ Multipart form data detected - currently not supported');
      console.log('📝 Attempting to extract prompt from raw body or fallback');
      
      // Try to extract just the prompt for now
      const prompt = req.body?.prompt || 'Generate a beautiful AI artwork';
      console.log('🎨 Using prompt:', prompt);
      
      await processImageGeneration({ body: { prompt }, files: [] } as any, res);
      
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
    res.status(500).json({ error: 'Request handling failed' });
  }
};

async function processImageGeneration(req: any, res: functions.Response): Promise<void> {
  try {
    console.log('📝 Request body keys:', Object.keys(req.body || {}));
    console.log('📁 Files received:', req.files ? req.files.length : 0);
    console.log('📋 Body prompt:', req.body?.prompt);
    
    const prompt = req.body?.prompt as string || 'Generate a beautiful AI artwork';
    const files = req.files || [];
    
    if (!prompt && files.length === 0) {
      res.status(400).json({
        error: 'Please provide a prompt or upload images'
      });
      return;
    }

    // Determine which model to use based on context
    const shouldGenerateImage = isImageGenerationRequest(prompt || '', files.length > 0);
    
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
          const modelName = 'gemini-2.5-flash-image-preview';
          console.log(`🤖 Using model: ${modelName}`);
          const genAI = getGenAI();
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
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp'
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
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
    res.status(500).json({
      error: error.message || 'Failed to process request'
    });
    return;
  }
}