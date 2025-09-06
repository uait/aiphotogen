import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateImage(prompt: string, uploadedImages?: File[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const formData = new FormData();
  formData.append('prompt', prompt);
  
  if (uploadedImages) {
    uploadedImages.forEach((image, index) => {
      formData.append(`image_${index}`, image);
    });
  }

  const response = await fetch('/api/generate-image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate image');
  }

  return response.json();
}

export async function processImageWithGemini(
  prompt: string,
  images?: { data: string; mimeType: string }[]
) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const parts: any[] = [prompt];
  
  if (images) {
    images.forEach(image => {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      });
    });
  }

  const result = await model.generateContent(parts);
  const response = await result.response;
  return response.text();
}