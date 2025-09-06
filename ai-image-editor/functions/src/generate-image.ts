import * as functions from 'firebase-functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
const multer = require('multer');

function getGenAI() {
  const config = functions.config();
  return new GoogleGenerativeAI(config.gemini?.api_key || '');
}

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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

  // Handle multipart form data
  const uploadFields = upload.array('image_0', 2);
  
  uploadFields(req, res, async (err: any) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    }

    try {
      const prompt = req.body.prompt as string;
      const files = req.files as Express.Multer.File[] || [];
      
      if (!prompt && files.length === 0) {
        return res.status(400).json({
          error: 'Please provide a prompt or upload images'
        });
      }

      // Determine which model to use based on context
      const shouldGenerateImage = isImageGenerationRequest(prompt || '', files.length > 0);
      
      if (shouldGenerateImage) {
        // Use Gemini for image generation with the latest model
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.0-flash-exp'
        });
        
        const parts: any[] = [];
        
        // Add text prompt for image generation
        if (prompt) {
          if (files.length > 0) {
            parts.push({ 
              text: `Please analyze this image and ${prompt}. Describe in detail what changes you would make to create the desired result. Be specific about colors, objects, positioning, and style.`
            });
          } else {
            parts.push({ 
              text: `Create a detailed description for generating an image: ${prompt}. Include specific details about composition, colors, lighting, style, and any objects or people that should be present.`
            });
          }
        }
        
        // Add images if provided
        if (files.length > 0) {
          for (const file of files) {
            const base64 = file.buffer.toString('base64');
            parts.push({
              inlineData: {
                mimeType: file.mimetype,
                data: base64
              }
            });
          }
        }
        
        // Generate content description with Gemini
        const result = await model.generateContent({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.8,
          }
        });
        
        const response = await result.response;
        const description = response.text();
        
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
              const base64 = file.buffer.toString('base64');
              parts.push({
                inlineData: {
                  mimeType: file.mimetype,
                  data: base64
                }
              });
            }
            
            contents = parts;
          } else {
            contents = [{
              text: `Create a detailed image: ${description}. Make it high-quality, artistic, and visually appealing.`
            }];
          }
          
          const imageResult = await imageModel.generateContent({
            contents: Array.isArray(contents) ? [{ role: 'user', parts: contents }] : contents,
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
              return res.status(400).json({
                error: 'This content couldn\'t be processed due to our content guidelines. Please try a different prompt or image.',
                errorType: 'CONTENT_VIOLATION',
                success: false
              });
            }
            
            if (candidate.finishReason === 'SAFETY') {
              return res.status(400).json({
                error: 'This request was blocked for safety reasons. Please ensure your content follows our guidelines.',
                errorType: 'SAFETY_VIOLATION',
                success: false
              });
            }
            
            // Look for image data in the response
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
                // Also check inlineData format
                if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                  const base64Image = part.inlineData.data;
                  const mimeType = part.inlineData.mimeType;
                  finalImageUrl = `data:${mimeType};base64,${base64Image}`;
                  console.log('✅ Found generated image in response');
                  break;
                }
              }
            }
          }
          
          if (!finalImageUrl) {
            throw new Error('No image data found in Gemini response');
          }
          
        } catch (geminiError) {
          console.error('Gemini image generation failed:', geminiError);
          modelUsed = 'fallback-service';
          
          // Fallback to external service
          const cleanPrompt = (prompt || description || 'AI generated artwork')
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .substring(0, 100);
          
          const imagePrompt = encodeURIComponent(cleanPrompt);
          const seed = Math.floor(Math.random() * 10000);
          
          finalImageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?seed=${seed}&width=512&height=512&nologo=true`;
        }
        
        return res.json({
          imageUrl: finalImageUrl,
          success: true,
          modelUsed: modelUsed,
          isImageGeneration: true,
          originalImages: files.length > 0 ? files.map(file => {
            const base64 = file.buffer.toString('base64');
            return `data:${file.mimetype};base64,${base64}`;
          }) : undefined
        });
        
      } else {
        // Use regular chat model for text-only conversations
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.0-flash-exp'
        });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        return res.json({
          text: text,
          success: true,
          modelUsed: 'gemini-2.0-flash-exp',
          isImageGeneration: false
        });
      }

    } catch (error: any) {
      console.error('Error processing request:', error);
      return res.status(500).json({
        error: error.message || 'Failed to process request'
      });
    }
  });
};