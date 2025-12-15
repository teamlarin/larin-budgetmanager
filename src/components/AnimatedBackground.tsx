import React from 'react';

export const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/30" />
      
      {/* Animated floating orbs */}
      <div 
        className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-primary/5 blur-3xl animate-float-slow"
        style={{ animationDelay: '0s' }}
      />
      <div 
        className="absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-secondary/8 blur-3xl animate-float-medium"
        style={{ animationDelay: '2s' }}
      />
      <div 
        className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-primary/4 blur-3xl animate-float-slow"
        style={{ animationDelay: '4s' }}
      />
      <div 
        className="absolute top-10 right-1/4 w-64 h-64 rounded-full bg-secondary/6 blur-3xl animate-float-fast"
        style={{ animationDelay: '1s' }}
      />
      
      {/* Subtle grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
};
