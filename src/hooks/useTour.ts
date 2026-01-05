import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TOUR_STORAGE_PREFIX = 'tour_completed_';

interface UseTourOptions {
  tourId: string;
  userId: string | null;
  autoStart?: boolean;
}

export function useTour({ tourId, userId, autoStart = true }: UseTourOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(true); // Default to true to prevent flash

  // Check if tour was completed (using localStorage for simplicity)
  useEffect(() => {
    if (!userId || !tourId) return;
    
    const storageKey = `${TOUR_STORAGE_PREFIX}${userId}_${tourId}`;
    const completed = localStorage.getItem(storageKey) === 'true';
    setHasCompleted(completed);
    
    // Auto-start tour if not completed
    if (autoStart && !completed) {
      // Small delay to ensure the page is fully loaded
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [userId, tourId, autoStart]);

  const startTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
  }, []);

  const completeTour = useCallback(() => {
    if (!userId || !tourId) return;
    
    const storageKey = `${TOUR_STORAGE_PREFIX}${userId}_${tourId}`;
    localStorage.setItem(storageKey, 'true');
    setHasCompleted(true);
    setIsOpen(false);
  }, [userId, tourId]);

  const resetTour = useCallback(() => {
    if (!userId || !tourId) return;
    
    const storageKey = `${TOUR_STORAGE_PREFIX}${userId}_${tourId}`;
    localStorage.removeItem(storageKey);
    setHasCompleted(false);
  }, [userId, tourId]);

  return {
    isOpen,
    hasCompleted,
    startTour,
    closeTour,
    completeTour,
    resetTour,
  };
}