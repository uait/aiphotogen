import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PixtorAI - AI-Powered Image Creation & Editing",
  description: "Transform your vision into reality with PixtorAI's advanced AI image generation and editing tools",
  icons: {
    icon: '/pixtor-logo.png',
    apple: '/pixtor-logo.png',
  },
  openGraph: {
    title: "PixtorAI - AI-Powered Image Creation & Editing",
    description: "Transform your vision into reality with PixtorAI's advanced AI image generation and editing tools",
    images: ['/pixtor-logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "PixtorAI - AI-Powered Image Creation & Editing",
    description: "Transform your vision into reality with PixtorAI's advanced AI image generation and editing tools",
    images: ['/pixtor-logo.png'],
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
