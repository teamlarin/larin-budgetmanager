import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tourFeedback } from '@/lib/tourFeedback';

// Animated arrow component
const AnimatedArrow = ({ position, targetRect }: { position: string; targetRect: DOMRect }) => {
  const getArrowStyle = () => {
    const padding = 20;
    
    switch (position) {
      case 'top':
        return {
          left: targetRect.left + targetRect.width / 2 - 12,
          top: targetRect.top - padding - 24,
          transform: 'rotate(180deg)',
        };
      case 'bottom':
        return {
          left: targetRect.left + targetRect.width / 2 - 12,
          top: targetRect.bottom + padding,
          transform: 'rotate(0deg)',
        };
      case 'left':
        return {
          left: targetRect.left - padding - 24,
          top: targetRect.top + targetRect.height / 2 - 12,
          transform: 'rotate(90deg)',
        };
      case 'right':
        return {
          left: targetRect.right + padding,
          top: targetRect.top + targetRect.height / 2 - 12,
          transform: 'rotate(-90deg)',
        };
      default:
        return { display: 'none' };
    }
  };

  return (
    <div
      className="fixed z-[10000] pointer-events-none"
      style={getArrowStyle()}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="animate-bounce-arrow text-primary drop-shadow-glow"
      >
        <path
          d="M12 4L12 20M12 20L6 14M12 20L18 14"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

// Pulsing ring animation around target
const PulsingRing = ({ targetRect }: { targetRect: DOMRect }) => (
  <>
    <div
      className="absolute rounded-lg pointer-events-none animate-ping-slow"
      style={{
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
        border: '2px solid hsl(var(--primary) / 0.5)',
      }}
    />
    <div
      className="absolute rounded-lg pointer-events-none animate-ping-slower"
      style={{
        top: targetRect.top - 12,
        left: targetRect.left - 12,
        width: targetRect.width + 24,
        height: targetRect.height + 24,
        border: '2px solid hsl(var(--primary) / 0.3)',
      }}
    />
  </>
);

// Spotlight effect
const SpotlightEffect = ({ targetRect }: { targetRect: DOMRect }) => (
  <div
    className="absolute pointer-events-none animate-spotlight"
    style={{
      top: targetRect.top - 20,
      left: targetRect.left - 20,
      width: targetRect.width + 40,
      height: targetRect.height + 40,
      background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
      borderRadius: '50%',
    }}
  />
);

export interface TourStep {
  target?: string; // CSS selector for the element to highlight
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
}

interface InteractiveTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  tourId: string;
}

export function InteractiveTour({ steps, isOpen, onClose, onComplete, tourId }: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const hasPlayedOpenSound = useRef(false);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Play open sound when tour starts
  useEffect(() => {
    if (isOpen && !hasPlayedOpenSound.current) {
      tourFeedback.open();
      hasPlayedOpenSound.current = true;
    }
    if (!isOpen) {
      hasPlayedOpenSound.current = false;
    }
  }, [isOpen]);

  const updateTargetPosition = useCallback(() => {
    if (step?.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [step?.target]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      return;
    }
    
    updateTargetPosition();
    
    // Update position on scroll/resize
    window.addEventListener('scroll', updateTargetPosition, true);
    window.addEventListener('resize', updateTargetPosition);
    
    return () => {
      window.removeEventListener('scroll', updateTargetPosition, true);
      window.removeEventListener('resize', updateTargetPosition);
    };
  }, [isOpen, currentStep, updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      tourFeedback.next();
      setCurrentStep(currentStep + 1);
    } else {
      tourFeedback.complete();
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      tourFeedback.back();
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGoToStep = (stepIndex: number) => {
    if (stepIndex !== currentStep) {
      if (stepIndex > currentStep) {
        tourFeedback.next();
      } else {
        tourFeedback.back();
      }
      setCurrentStep(stepIndex);
    }
  };

  const handleSkip = () => {
    tourFeedback.skip();
    onClose();
  };

  if (!isOpen) return null;

  const getCardPosition = () => {
    if (!targetRect || step.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const cardWidth = 400;
    const cardHeight = 250;

    switch (step.position) {
      case 'top':
        return {
          position: 'fixed' as const,
          top: `${Math.max(padding, targetRect.top - cardHeight - padding)}px`,
          left: `${Math.max(padding, Math.min(window.innerWidth - cardWidth - padding, targetRect.left + targetRect.width / 2 - cardWidth / 2))}px`,
        };
      case 'bottom':
        return {
          position: 'fixed' as const,
          top: `${Math.min(window.innerHeight - cardHeight - padding, targetRect.bottom + padding)}px`,
          left: `${Math.max(padding, Math.min(window.innerWidth - cardWidth - padding, targetRect.left + targetRect.width / 2 - cardWidth / 2))}px`,
        };
      case 'left':
        return {
          position: 'fixed' as const,
          top: `${Math.max(padding, Math.min(window.innerHeight - cardHeight - padding, targetRect.top + targetRect.height / 2 - cardHeight / 2))}px`,
          left: `${Math.max(padding, targetRect.left - cardWidth - padding)}px`,
        };
      case 'right':
        return {
          position: 'fixed' as const,
          top: `${Math.max(padding, Math.min(window.innerHeight - cardHeight - padding, targetRect.top + targetRect.height / 2 - cardHeight / 2))}px`,
          left: `${Math.min(window.innerWidth - cardWidth - padding, targetRect.right + padding)}px`,
        };
      default:
        return {
          position: 'fixed' as const,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] animate-fade-in pointer-events-none">
      {/* Overlay leggero - permette di vedere il frontend */}
      <div 
        className="absolute inset-0 bg-black/30 transition-opacity duration-300 pointer-events-auto" 
        onClick={handleSkip} 
      />
      
      {/* Spotlight effect più intenso */}
      {targetRect && <SpotlightEffect targetRect={targetRect} />}
      
      {/* Pulsing rings */}
      {targetRect && <PulsingRing targetRect={targetRect} />}
      
      {/* Highlight area - cutout trasparente per mostrare l'elemento target */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            background: 'transparent',
          }}
        >
          <div className="absolute inset-0 rounded-lg ring-4 ring-primary/40 animate-pulse" />
        </div>
      )}

      {/* Animated Arrow */}
      {targetRect && step.position && step.position !== 'center' && (
        <AnimatedArrow position={step.position} targetRect={targetRect} />
      )}

      {/* Tour Card */}
      <Card
        className="w-[400px] max-w-[calc(100vw-32px)] shadow-2xl z-10 border-primary/20 animate-scale-in bg-card pointer-events-auto"
        style={getCardPosition()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {step.icon || <Sparkles className="h-5 w-5 text-primary" />}
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-sm">
            Passaggio {currentStep + 1} di {steps.length}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {/* Step dots navigation */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center justify-center gap-2 w-full">
              {steps.map((s, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleGoToStep(index)}
                      className={cn(
                        "w-2.5 h-2.5 rounded-full transition-all duration-300 hover:scale-125",
                        index === currentStep
                          ? "bg-primary w-6 shadow-md"
                          : index < currentStep
                            ? "bg-primary/60 hover:bg-primary/80"
                            : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      )}
                      aria-label={`Vai al passaggio ${index + 1}: ${s.title}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-muted-foreground">Passaggio {index + 1}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
          
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Salta tour
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Indietro
              </Button>
              <Button size="sm" onClick={handleNext}>
                {currentStep === steps.length - 1 ? (
                  'Completa'
                ) : (
                  <>
                    Avanti
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>,
    document.body
  );
}