// API configuration for different environments
export const API_CONFIG = {
  // In production, use the Firebase Functions URL
  // In development, try local API routes first, fallback to Functions
  baseUrl: process.env.NODE_ENV === 'production' 
    ? '/api' // Firebase hosting will route this to Functions via firebase.json
    : '/api'  // Try local first, fallback handled in individual API calls
};

export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`;
}