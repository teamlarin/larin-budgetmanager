import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

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
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
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
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSkip} />
      
      {/* Highlight area */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        >
          <div className="absolute inset-0 rounded-lg animate-pulse bg-primary/20" />
        </div>
      )}

      {/* Tour Card */}
      <Card
        className="w-[400px] max-w-[calc(100vw-32px)] shadow-2xl z-10 border-primary/20"
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
          <Progress value={progress} className="h-1.5" />
          
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