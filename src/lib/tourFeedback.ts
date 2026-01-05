// Audio and haptic feedback for the interactive tour

// Audio context singleton
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Haptic feedback (mobile devices)
export const triggerHaptic = (pattern: 'light' | 'medium' | 'success' = 'light') => {
  if (!('vibrate' in navigator)) return;
  
  switch (pattern) {
    case 'light':
      navigator.vibrate(10);
      break;
    case 'medium':
      navigator.vibrate(25);
      break;
    case 'success':
      navigator.vibrate([50, 30, 50]);
      break;
  }
};

// Simple synthesized sounds
export const playSound = (type: 'click' | 'next' | 'back' | 'complete' | 'open') => {
  try {
    const ctx = getAudioContext();
    
    // Resume audio context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case 'click':
        // Short, subtle click
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialDecayTo(0.001, now + 0.05);
        oscillator.start(now);
        oscillator.stop(now + 0.05);
        break;

      case 'next':
        // Rising tone for forward progression
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.1);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialDecayTo(0.001, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;

      case 'back':
        // Falling tone for going back
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.1);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialDecayTo(0.001, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;

      case 'complete':
        // Pleasant success chord
        playChord(ctx, [523.25, 659.25, 783.99], 0.12, 0.4); // C major chord
        break;

      case 'open':
        // Soft whoosh-like sound
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gainNode.gain.exponentialDecayTo(0.001, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;
    }
  } catch (e) {
    // Silently fail if audio is not available
    console.debug('Audio feedback not available:', e);
  }
};

// Helper to play a chord (multiple frequencies)
const playChord = (ctx: AudioContext, frequencies: number[], volume: number, duration: number) => {
  const now = ctx.currentTime;
  
  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(freq, now);
    oscillator.type = 'sine';
    
    // Stagger slightly for a richer sound
    const startTime = now + i * 0.02;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
    gainNode.gain.exponentialDecayTo(0.001, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  });
};

// Polyfill for exponentialDecayTo (not a real Web Audio method)
// We need to extend GainNode
declare global {
  interface AudioParam {
    exponentialDecayTo(value: number, endTime: number): void;
  }
}

// Add the helper method to AudioParam prototype
if (typeof AudioParam !== 'undefined' && !AudioParam.prototype.exponentialDecayTo) {
  AudioParam.prototype.exponentialDecayTo = function(value: number, endTime: number) {
    // exponentialRampToValueAtTime can't go to 0, so use a very small value
    this.exponentialRampToValueAtTime(Math.max(value, 0.0001), endTime);
  };
}

// Combined feedback function
export const tourFeedback = {
  open: () => {
    playSound('open');
    triggerHaptic('medium');
  },
  next: () => {
    playSound('next');
    triggerHaptic('light');
  },
  back: () => {
    playSound('back');
    triggerHaptic('light');
  },
  complete: () => {
    playSound('complete');
    triggerHaptic('success');
  },
  skip: () => {
    playSound('click');
    triggerHaptic('light');
  }
};
