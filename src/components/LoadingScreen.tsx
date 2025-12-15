import React from 'react';
import logoTT from '@/assets/logo-tt.svg';

export const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      
      {/* Logo container with animations */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Pulsing ring behind logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        
        {/* Rotating ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-28 h-28 rounded-full border-2 border-transparent border-t-primary border-r-primary/50 animate-spin"
            style={{ animationDuration: '1.5s' }}
          />
        </div>
        
        {/* Logo with scale animation */}
        <div className="relative w-20 h-20 animate-pulse">
          <img 
            src={logoTT} 
            alt="TimeTrap" 
            className="w-full h-full object-contain drop-shadow-lg"
          />
        </div>
        
        {/* Brand name */}
        <div className="mt-4 flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-foreground tracking-tight">
            TimeTrap
          </span>
          <span className="text-sm text-muted-foreground animate-pulse">
            Make smartworking smarter
          </span>
        </div>
        
        {/* Loading dots */}
        <div className="flex gap-1.5 mt-2">
          <div 
            className="w-2 h-2 rounded-full bg-primary animate-bounce" 
            style={{ animationDelay: '0ms', animationDuration: '0.8s' }} 
          />
          <div 
            className="w-2 h-2 rounded-full bg-primary animate-bounce" 
            style={{ animationDelay: '150ms', animationDuration: '0.8s' }} 
          />
          <div 
            className="w-2 h-2 rounded-full bg-primary animate-bounce" 
            style={{ animationDelay: '300ms', animationDuration: '0.8s' }} 
          />
        </div>
      </div>
    </div>
  );
};
