# AI Photo Magic - Setup Guide

## 🚀 Quick Start

Your AI Image Editor is now running at http://localhost:3003

## 📋 Required Configuration

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google provider
   - Enable Phone authentication
4. Create a Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Choose your preferred location
5. Enable Storage:
   - Go to Storage
   - Click Get Started
   - Choose production mode
6. Get your configuration:
   - Go to Project Settings > General
   - Scroll down to "Your apps" and click "Add app"
   - Choose Web (</>)
   - Register your app
   - Copy the configuration values

### 2. Gemini API Setup

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create or select a project
3. Generate an API key
4. Copy the API key

### 3. Update Environment Variables

Edit the `.env.local` file with your credentials:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Gemini API
GEMINI_API_KEY=your-gemini-api-key
```

### 4. Firebase Security Rules

#### Firestore Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /conversations/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    match /conversationSummaries/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

#### Storage Rules:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🎨 Features

- **Multiple Authentication Methods**: Email/Password, Google Sign-in, Phone authentication
- **AI Image Generation**: Create images from text prompts
- **Image Editing**: Upload up to 2 images for AI-powered editing
- **Chat Interface**: Seamless conversation-style interaction
- **History Management**: View and manage all your creations
- **Download Images**: Save your generated images
- **Delete Management**: Remove unwanted images and conversations
- **Magic Animation**: Beautiful loading animation while AI processes your request

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📱 Usage

1. Sign up or log in using your preferred method
2. Type a prompt to generate an image from text
3. Or upload 1-2 images to edit them with AI
4. View your conversation history in the sidebar
5. Download generated images
6. Delete conversations you no longer need

## 🔧 Troubleshooting

- **Port already in use**: The app will automatically use the next available port
- **Firebase errors**: Make sure all Firebase services are enabled
- **Authentication issues**: Check that your Firebase configuration is correct
- **Image upload fails**: Verify Storage rules and bucket configuration

## 📝 Notes

- The current implementation uses a placeholder for actual Gemini image generation
- To implement real image generation, update `/app/api/generate-image/route.ts` with the actual Gemini API integration
- Phone authentication requires a real domain in production (not localhost)

## 🚀 Deployment

For production deployment:
1. Update `NEXTAUTH_URL` in environment variables
2. Configure Firebase for your production domain
3. Set up proper CORS rules for Storage
4. Deploy to Vercel, Netlify, or your preferred platform