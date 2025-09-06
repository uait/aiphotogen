import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Keywords that indicate image generation request
const IMAGE_GENERATION_KEYWORDS = [
  'generate', 'create', 'make', 'draw', 'design', 'produce',
  'image', 'picture', 'photo', 'illustration', 'artwork',
  'edit', 'modify', 'enhance', 'transform', 'change', 'add', 'remove'
];

function isImageGenerationRequest(prompt: string, hasImages: boolean): boolean {
  if (hasImages) return true; // Always use image model if images are uploaded
  
  const lowerPrompt = prompt.toLowerCase();
  return IMAGE_GENERATION_KEYWORDS.some(keyword => lowerPrompt.includes(keyword));
}

async function saveImageBuffer(buffer: Buffer, fileName: string): Promise<string> {
  // In a real implementation, you'd upload to your storage service
  // For now, we'll convert to base64 data URL
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

export async function POST(request: NextRequest) {
  try {
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

    // Determine which model to use based on context
    const shouldGenerateImage = isImageGenerationRequest(prompt || '', images.length > 0);
    
    if (shouldGenerateImage) {
      // Use Gemini for image generation with the latest model
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp' // Using latest Gemini model
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
      
      // Use Gemini 2.5 Flash Image (nano banana) for actual image generation
      let finalImageUrl = '';
      let modelUsed = 'gemini-2.5-flash-image-preview';
      
      try {
        // Use the single specified model for all image generation
        const modelName = 'gemini-2.5-flash-image-preview';
        
        console.log(`🤖 Using model: ${modelName} (${images.length > 0 ? 'image editing' : 'text-to-image'})`);
        const imageModel = genAI.getGenerativeModel({ model: modelName });
        
        // Create the content in the correct format for nano banana
        let contents;
        
        if (images.length > 0) {
          console.log(`📸 Processing ${images.length} uploaded images for editing...`);
          
          // For image editing - create array with text and image parts
          const parts: any[] = [];
          
          parts.push({
            text: `Edit this image: ${description}. Create a high-quality, detailed result.`
          });
          
          // Add uploaded images
          for (let i = 0; i < images.length; i++) {
            const image = images[i];
            console.log(`📸 Image ${i + 1}: ${image.name}, type: ${image.type}, size: ${image.size} bytes`);
            
            const bytes = await image.arrayBuffer();
            const base64 = Buffer.from(bytes).toString('base64');
            const base64Preview = base64.substring(0, 50) + '...';
            
            console.log(`📸 Image ${i + 1} converted to base64: ${base64Preview} (${base64.length} chars)`);
            
            parts.push({
              inlineData: {
                mimeType: image.type,
                data: base64
              }
            });
          }
          
          console.log(`📸 Created parts array with ${parts.length} items (1 text + ${images.length} images)`);
          contents = parts;
        } else {
          console.log('🎨 Pure image generation (no uploaded images)');
          // For pure image generation - use parts format like image editing
          contents = [{
            text: `Create a detailed image: ${description}. Make it high-quality, artistic, and visually appealing.`
          }];
        }
        
        console.log('Calling Gemini nano banana with:', { model: 'gemini-2.5-flash-image-preview' });
        
        const imageResult = await imageModel.generateContent({
          contents: Array.isArray(contents) ? [{ role: 'user', parts: contents }] : contents,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.8,
            responseModalities: ['TEXT', 'IMAGE'], // Request both text and image output
          }
        });
        
        const imageResponse = await imageResult.response;
        console.log('Gemini nano banana response received, examining structure...');
        console.log('Response candidates:', JSON.stringify(imageResponse.candidates, null, 2));
        
        // Check for content policy violations
        const candidates = imageResponse.candidates;
        if (candidates && candidates.length > 0) {
          const candidate = candidates[0];
          
          // Check for RECITATION or other safety filters
          if (candidate.finishReason === 'RECITATION') {
            console.log('⚠️ Content blocked due to RECITATION');
            return NextResponse.json({
              error: 'This content couldn\'t be processed due to our content guidelines. Please try a different prompt or image.',
              errorType: 'CONTENT_VIOLATION',
              success: false
            }, { status: 400 });
          }
          
          if (candidate.finishReason === 'SAFETY') {
            console.log('⚠️ Content blocked due to safety concerns');
            return NextResponse.json({
              error: 'This request was blocked for safety reasons. Please ensure your content follows our guidelines.',
              errorType: 'SAFETY_VIOLATION',
              success: false
            }, { status: 400 });
          }
          
          if (candidate.finishReason === 'OTHER') {
            console.log('⚠️ Content blocked for other reasons');
            return NextResponse.json({
              error: 'Unable to process this request. Please try again with different content.',
              errorType: 'PROCESSING_ERROR',
              success: false
            }, { status: 400 });
          }
          
          // Look for image data in the response
          const parts = candidate.content?.parts;
          console.log('Found parts:', parts?.length || 0);
          if (parts) {
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              console.log(`Part ${i}:`, Object.keys(part));
              
              // Check for inline_data with image
              if (part.inline_data && part.inline_data.mime_type?.startsWith('image/')) {
                const base64Image = part.inline_data.data;
                const mimeType = part.inline_data.mime_type;
                finalImageUrl = `data:${mimeType};base64,${base64Image}`;
                console.log('✅ Found generated image in response (inline_data format)');
                break;
              }
              // Also check inlineData format
              if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                const base64Image = part.inlineData.data;
                const mimeType = part.inlineData.mimeType;
                finalImageUrl = `data:${mimeType};base64,${base64Image}`;
                console.log('✅ Found generated image in response (inlineData format)');
                break;
              }
              // Check for text responses
              if (part.text) {
                console.log('Found text response:', part.text.substring(0, 100) + '...');
              }
            }
          }
        }
        
        if (!finalImageUrl) {
          console.log('❌ No image data found in Gemini response');
          throw new Error('No image data found in Gemini response');
        }
        
        // Return the Gemini-generated image directly as data URL
        // Do not upload to Firebase Storage to avoid size issues
        console.log('✅ Using Gemini-generated image directly');
        
      } catch (geminiError) {
        console.error('Gemini nano banana failed:', geminiError);
        modelUsed = 'fallback-service';
        
        // Fallback to external service only if Gemini fails
        const cleanPrompt = (prompt || description || 'AI generated artwork')
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .substring(0, 100);
        
        const imagePrompt = encodeURIComponent(cleanPrompt);
        const seed = Math.floor(Math.random() * 10000);
        
        // Use Pollinations AI as primary fallback since it's AI-generated
        finalImageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?seed=${seed}&width=512&height=512&nologo=true`;
      }
      
      return NextResponse.json({
        imageUrl: finalImageUrl,
        success: true,
        modelUsed: modelUsed,
        isImageGeneration: true,
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
      
      return NextResponse.json({
        text: text,
        success: true,
        modelUsed: 'gemini-2.0-flash-exp',
        isImageGeneration: false
      });
    }

  } catch (error: any) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}