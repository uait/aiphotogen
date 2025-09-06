'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function MagicAnimation() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prev => [
        ...prev.slice(-20),
        {
          id: Date.now(),
          x: Math.random() * 100,
          y: Math.random() * 100,
        },
      ]);
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-64 bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="w-32 h-32 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full animate-pulse opacity-20 blur-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-white animate-spin" />
          </div>
        </div>
      </div>
      
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-float"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animation: `float 3s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 backdrop-blur-[2px]" />
      
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-white font-medium animate-pulse">
          Casting AI magic over your image...
        </p>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          50% {
            transform: translateY(-20px) scale(1.5);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}