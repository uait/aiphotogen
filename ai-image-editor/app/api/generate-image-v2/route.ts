import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from 'firebase-admin/auth';
import { SubscriptionService } from '@/lib/services/subscription';
import { OperationType, ModelTier } from '@/lib/types/subscription';
import { getModelConfigByTier, getHighestAllowedTierForPlan } from '@/lib/config/subscription';

// Initialize Firebase Admin if not already done
if (!process.env.FIREBASE_ADMIN_INITIALIZED) {
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  
  if (getApps().length === 0) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
      process.env.FIREBASE_ADMIN_INITIALIZED = 'true';
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
    }
  }
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Keywords that indicate image generation request
const IMAGE_GENERATION_KEYWORDS = [
  'generate', 'create', 'make', 'draw', 'design', 'produce',
  'image', 'picture', 'photo', 'illustration', 'artwork',
  'edit', 'modify', 'enhance', 'transform', 'change', 'add', 'remove'
];

// Advanced operation detection
const ADVANCED_OPERATION_KEYWORDS = {
  [OperationType.UPSCALE]: ['upscale', 'enhance resolution', 'higher quality', 'bigger size', 'hd', '4k'],
  [OperationType.BACKGROUND_REMOVAL]: ['remove background', 'transparent background', 'cut out', 'isolate subject'],
  [OperationType.OBJECT_REMOVAL]: ['remove object', 'delete', 'erase', 'clean up', 'unwanted'],
  [OperationType.INPAINTING]: ['inpaint', 'fill in', 'complete', 'restore', 'fix missing']
};

function isImageGenerationRequest(prompt: string, hasImages: boolean): boolean {
  if (hasImages) return true; // Always use image model if images are uploaded
  
  const lowerPrompt = prompt.toLowerCase();
  return IMAGE_GENERATION_KEYWORDS.some(keyword => lowerPrompt.includes(keyword));
}

function detectOperationType(prompt: string, hasImages: boolean): OperationType {
  const lowerPrompt = prompt.toLowerCase();
  
  // Check for advanced operations
  for (const [operation, keywords] of Object.entries(ADVANCED_OPERATION_KEYWORDS)) {
    if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
      return operation as OperationType;
    }
  }
  
  // Default to generation or edit based on context
  return hasImages ? OperationType.EDIT : OperationType.GENERATION;
}

async function verifyAuthToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decodedToken = await auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | null = null;
  let operationType: OperationType = OperationType.GENERATION;
  let modelTier: ModelTier = ModelTier.LITE;
  let modelId = 'gemini-2.5-flash-image-preview';

  try {
    // Parse request data
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const images: File[] = [];
    
    for (let i = 0; i < 2; i++) {
      const image = formData.get(`image_${i}`) as File;
      if (image) {
        images.push(image);
      }
    }

    if (!prompt && images.length === 0) {
      return NextResponse.json(
        { error: 'Please provide a prompt or upload images' },
        { status: 400 }
      );
    }

    // Get subscription config and check if feature is enabled
    const subscriptionService = SubscriptionService.getInstance();
    
    // Verify authentication for usage tracking (optional for now - can be anonymous)
    const authHeader = request.headers.get('authorization');
    userId = await verifyAuthToken(authHeader);
    
    // Determine operation type
    operationType = detectOperationType(prompt || '', images.length > 0);
    
    // If user is authenticated, check limits and permissions
    if (userId) {
      // Check usage limits
      const usageLimitResult = await subscriptionService.checkUsageLimit(userId, operationType);
      if (!usageLimitResult.allowed) {
        return NextResponse.json({
          error: 'Daily usage limit exceeded',
          errorType: 'USAGE_LIMIT_EXCEEDED',
          limit: usageLimitResult.limit,
          remaining: usageLimitResult.remaining,
          resetAt: usageLimitResult.resetAt.toISOString(),
          plan: usageLimitResult.plan,
          success: false
        }, { status: 429 });
      }

      // Check feature gate and model tier access
      const featureGateResult = await subscriptionService.checkFeatureGate(userId, operationType);
      if (!featureGateResult.allowed) {
        return NextResponse.json({
          error: featureGateResult.reason || 'Feature not available in current plan',
          errorType: 'FEATURE_GATE_BLOCKED',
          suggestedPlan: featureGateResult.suggestedPlan,
          requiredTier: featureGateResult.requiredTier,
          success: false
        }, { status: 403 });
      }

      // Get the highest allowed tier for the user's plan
      const userPlan = await subscriptionService.getUserPlan(userId);
      const highestTier = getHighestAllowedTierForPlan(userPlan.id);
      if (highestTier) {
        modelTier = highestTier;
        const modelConfig = getModelConfigByTier(modelTier);
        if (modelConfig) {
          modelId = modelConfig.modelId;
        }
      }
    }

    // Determine which model to use based on context
    const shouldGenerateImage = isImageGenerationRequest(prompt || '', images.length > 0);
    
    if (shouldGenerateImage) {
      // Use Gemini for image generation with the determined model
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp' // Using latest Gemini model for description
      });
      
      const parts: any[] = [];
      
      // Add text prompt for image generation
      if (prompt) {
        if (images.length > 0) {
          // Image editing prompt
          parts.push({ 
            text: `Please analyze this image and ${prompt}. Describe in detail what changes you would make to create the desired result. Be specific about colors, objects, positioning, and style.`
          });
        } else {
          // Pure image generation prompt
          parts.push({ 
            text: `Create a detailed description for generating an image: ${prompt}. Include specific details about composition, colors, lighting, style, and any objects or people that should be present.`
          });
        }
      }
      
      // Add images if provided
      if (images.length > 0) {
        for (const image of images) {
          const bytes = await image.arrayBuffer();
          const base64 = Buffer.from(bytes).toString('base64');
          parts.push({
            inlineData: {
              mimeType: image.type,
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
      
      // Use determined model for actual image generation
      let finalImageUrl = '';
      let usedModelId = modelId;
      
      try {
        console.log(`🤖 Using model: ${usedModelId} (tier: ${modelTier}) for ${operationType}`);
        const imageModel = genAI.getGenerativeModel({ model: usedModelId });
        
        // Create the content in the correct format
        let contents;
        
        if (images.length > 0) {
          console.log(`📸 Processing ${images.length} uploaded images for editing...`);
          
          const parts: any[] = [];
          parts.push({
            text: `Edit this image: ${description}. Create a high-quality, detailed result.`
          });
          
          // Add uploaded images
          for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const bytes = await image.arrayBuffer();
            const base64 = Buffer.from(bytes).toString('base64');
            
            parts.push({
              inlineData: {
                mimeType: image.type,
                data: base64
              }
            });
          }
          
          contents = parts;
        } else {
          console.log('🎨 Pure image generation (no uploaded images)');
          contents = [{
            text: `Create a detailed image: ${description}. Make it high-quality, artistic, and visually appealing.`
          }];
        }
        
        const imageResult = await imageModel.generateContent({
          contents: Array.isArray(contents) ? [{ role: 'user', parts: contents }] : contents,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.8,
            responseModalities: ['TEXT', 'IMAGE'],
          }
        });
        
        const imageResponse = await imageResult.response;
        console.log('Gemini response received, examining structure...');
        
        // Check for content policy violations
        const candidates = imageResponse.candidates;
        if (candidates && candidates.length > 0) {
          const candidate = candidates[0];
          
          if (candidate.finishReason === 'RECITATION') {
            throw new Error('Content blocked due to RECITATION');
          }
          
          if (candidate.finishReason === 'SAFETY') {
            throw new Error('Content blocked for safety reasons');
          }
          
          if (candidate.finishReason === 'OTHER') {
            throw new Error('Unable to process this request');
          }
          
          // Look for image data in the response
          const parts = candidate.content?.parts;
          if (parts) {
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              
              if (part.inline_data && part.inline_data.mime_type?.startsWith('image/')) {
                const base64Image = part.inline_data.data;
                const mimeType = part.inline_data.mime_type;
                finalImageUrl = `data:${mimeType};base64,${base64Image}`;
                console.log('✅ Found generated image in response');
                break;
              }
              
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
        usedModelId = 'fallback-service';
        
        // Fallback to external service
        const cleanPrompt = (prompt || description || 'AI generated artwork')
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .substring(0, 100);
        
        const imagePrompt = encodeURIComponent(cleanPrompt);
        const seed = Math.floor(Math.random() * 10000);
        
        finalImageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?seed=${seed}&width=512&height=512&nologo=true`;
      }
      
      const processingTime = Date.now() - startTime;
      
      // Record usage if user is authenticated
      if (userId) {
        try {
          await subscriptionService.recordUsage(
            userId,
            operationType,
            modelTier,
            usedModelId,
            true, // success
            undefined,
            processingTime
          );
          console.log(`Usage recorded for user ${userId}: ${operationType} using ${usedModelId}`);
        } catch (error) {
          console.error('Failed to record usage:', error);
          // Don't fail the request if usage recording fails
        }
      }
      
      return NextResponse.json({
        imageUrl: finalImageUrl,
        success: true,
        modelUsed: usedModelId,
        modelTier,
        operationType,
        isImageGeneration: true,
        processingTimeMs: processingTime,
        originalImages: images.length > 0 ? await Promise.all(
          images.map(async (img) => {
            const bytes = await img.arrayBuffer();
            const base64 = Buffer.from(bytes).toString('base64');
            return `data:${img.type};base64,${base64}`;
          })
        ) : undefined
      });
      
    } else {
      // Use regular chat model for text-only conversations
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp'
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const processingTime = Date.now() - startTime;
      
      // Record usage for text operations too if user is authenticated
      if (userId) {
        try {
          await subscriptionService.recordUsage(
            userId,
            OperationType.GENERATION, // Text generation
            ModelTier.LITE,
            'gemini-2.0-flash-exp',
            true,
            undefined,
            processingTime
          );
        } catch (error) {
          console.error('Failed to record usage:', error);
        }
      }
      
      return NextResponse.json({
        text: text,
        success: true,
        modelUsed: 'gemini-2.0-flash-exp',
        modelTier: ModelTier.LITE,
        operationType: OperationType.GENERATION,
        isImageGeneration: false,
        processingTimeMs: processingTime
      });
    }

  } catch (error: any) {
    console.error('Error processing request:', error);
    
    const processingTime = Date.now() - startTime;
    
    // Record failed usage if user is authenticated
    if (userId) {
      try {
        await subscriptionService.recordUsage(
          userId,
          operationType,
          modelTier,
          modelId,
          false, // failed
          error.message,
          processingTime
        );
      } catch (recordError) {
        console.error('Failed to record failed usage:', recordError);
      }
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process request',
        success: false,
        processingTimeMs: processingTime
      },
      { status: 500 }
    );
  }
}