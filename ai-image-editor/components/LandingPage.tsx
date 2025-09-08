'use client';

import { useState } from 'react';
import { ArrowRight, Check, Sparkles, Zap, Image as ImageIcon, MessageSquare, Star, Users, Shield, Rocket } from 'lucide-react';
import PixtorLogo from './PixtorLogo';
import AuthModal from './AuthModal';
import Link from 'next/link';

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const features = [
    {
      icon: MessageSquare,
      title: "AI Chat Assistant",
      description: "Get instant help, creative ideas, and answers from our advanced AI chatbot."
    },
    {
      icon: ImageIcon,
      title: "Image Generation",
      description: "Create stunning visuals from text prompts using cutting-edge AI technology."
    },
    {
      icon: Sparkles,
      title: "Photo Editing",
      description: "Transform and enhance your photos with intelligent editing tools."
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Get results in seconds with our optimized AI processing pipeline."
    }
  ];

  const benefits = [
    "Unlimited creativity with AI-powered generation",
    "Professional-quality results in seconds",
    "No design experience required",
    "Works on any device, anywhere",
    "24/7 AI assistant support",
    "Regular updates with new features"
  ];

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "month",
      description: "Perfect for trying out PixtorAI",
      features: [
        "5 AI generations per day",
        "Basic AI Generation",
        "Basic Image Editing",
        "PixtorAI Lite model access"
      ],
      cta: "Get Started Free",
      popular: false
    },
    {
      name: "Starter",
      price: "$4.99",
      period: "month",
      description: "Great for casual creators",
      features: [
        "50 AI generations per day",
        "Basic AI Generation",
        "Basic Image Editing",
        "Background Removal (10/month)",
        "PixtorAI Lite model access"
      ],
      cta: "Start Creating",
      popular: false
    },
    {
      name: "Creator",
      price: "$9.99",
      period: "month",
      description: "Best for creative professionals",
      features: [
        "150 AI generations per day",
        "Advanced Editing Tools",
        "Unlimited Background Removal",
        "Priority Processing",
        "PixtorAI Lite & Standard models"
      ],
      cta: "Upgrade to Creator",
      popular: true
    },
    {
      name: "Pro",
      price: "$14.99",
      period: "month",
      description: "For power users and businesses",
      features: [
        "300 AI generations per day",
        "HD Generation & Full Editing Suite",
        "Batch Processing",
        "Object Removal & AI Inpainting",
        "Highest Priority Processing",
        "Early Access to New Features",
        "All PixtorAI models (Lite, Standard, Pro)"
      ],
      cta: "Go Pro",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <PixtorLogo size="sm" className="text-gray-900" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
              <Link href="/app" className="text-gray-600 hover:text-gray-900 font-medium">Sign In</Link>
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Get Started
              </button>
            </div>
            <div className="md:hidden">
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-black text-white px-4 py-2 rounded-lg font-medium text-sm"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-20 sm:pt-24 sm:pb-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
            Create Amazing Content with{' '}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AI-Powered Tools
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Generate stunning images, get instant answers, and unleash your creativity with PixtorAI's 
            advanced artificial intelligence platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-black text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors flex items-center gap-2 group"
            >
              Start Creating Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <Link
              href="/app"
              className="text-gray-600 hover:text-gray-900 font-medium text-lg flex items-center gap-2"
            >
              View Demo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            <div>
              <div className="text-3xl font-bold text-gray-900">50K+</div>
              <div className="text-gray-600">Happy Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">1M+</div>
              <div className="text-gray-600">Images Created</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">99.9%</div>
              <div className="text-gray-600">Uptime</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">4.9★</div>
              <div className="text-gray-600">User Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-4">
              Everything You Need to Create
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful AI tools designed to help you bring your ideas to life faster than ever before.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center group">
                <div className="bg-gray-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-gray-200 transition-colors">
                  <feature.icon className="w-8 h-8 text-gray-700" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-6">
                Why Choose PixtorAI?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Join thousands of creators, marketers, and businesses who trust PixtorAI 
                to power their creative workflows.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Sarah Chen</div>
                  <div className="text-gray-600">Marketing Director</div>
                </div>
              </div>
              <p className="text-gray-700 italic">
                "PixtorAI has revolutionized our content creation process. We can now generate 
                professional marketing visuals in minutes instead of hours. The quality is 
                consistently amazing!"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the perfect plan for your needs. Start free and upgrade as you grow.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`bg-white border-2 rounded-2xl p-8 relative ${
                  plan.popular
                    ? 'border-black shadow-2xl scale-105'
                    : 'border-gray-200 hover:border-gray-300'
                } transition-all`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-black text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600">/{plan.period}</span>
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                    plan.popular
                      ? 'bg-black text-white hover:bg-gray-800'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Creative Process?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of creators who are already using PixtorAI to bring their ideas to life.
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-white text-black px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-2 group"
          >
            Start Your Free Trial
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <PixtorLogo size="sm" className="text-gray-900 mb-4" />
              <p className="text-gray-600 mb-4 max-w-md">
                AI-powered creative tools that help you generate stunning visuals and get instant answers to your questions.
              </p>
              <div className="text-sm text-gray-500">
                © 2024 PixtorAI. All rights reserved.
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Product</h3>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#features" className="hover:text-gray-900">Features</a></li>
                <li><a href="#pricing" className="hover:text-gray-900">Pricing</a></li>
                <li><Link href="/app" className="hover:text-gray-900">Try Demo</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Support</h3>
              <ul className="space-y-2 text-gray-600">
                <li><a href="mailto:support@pixtorai.com" className="hover:text-gray-900">Contact Us</a></li>
                <li><a href="#" className="hover:text-gray-900">Help Center</a></li>
                <li><a href="#" className="hover:text-gray-900">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        redirectTo="/app"
      />
    </div>
  );
}