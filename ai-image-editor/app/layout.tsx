import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://pixtorai.com'),
  title: "PixtorAI - AI-Powered Creative Tools | Generate Images & Get Instant Answers",
  description: "Generate stunning images from text prompts, get instant AI answers, and unleash your creativity with PixtorAI's advanced artificial intelligence platform. Start free today!",
  keywords: ["AI image generation", "AI chatbot", "photo editing", "artificial intelligence", "creative tools", "text to image", "AI assistant"],
  authors: [{ name: "PixtorAI" }],
  creator: "PixtorAI",
  publisher: "PixtorAI",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
  },
  icons: {
    icon: '/pixtor-logo.png',
    apple: '/pixtor-logo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://pixtorai.com',
    title: "PixtorAI - AI-Powered Creative Tools",
    description: "Generate stunning images from text prompts, get instant AI answers, and unleash your creativity with PixtorAI's advanced artificial intelligence platform.",
    siteName: 'PixtorAI',
    images: [
      {
        url: '/pixtor-logo.png',
        width: 1200,
        height: 630,
        alt: 'PixtorAI - AI-Powered Creative Tools',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "PixtorAI - AI-Powered Creative Tools",
    description: "Generate stunning images from text prompts, get instant AI answers, and unleash your creativity with PixtorAI's advanced artificial intelligence platform.",
    creator: '@pixtorai',
    images: ['/pixtor-logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white`} suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#1f2937',
                color: '#fff',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
