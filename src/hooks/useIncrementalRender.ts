import { useEffect, useRef, useState } from 'react';

/**
 * Rendering incrementale: espone quante righe rendere, partendo da un primo blocco
 * immediato e aggiungendo i successivi in frame separati, così il thread principale
 * resta libero (UI reattiva) anche con molte task.
 *
 * Con liste piccole (<= initial) non cambia nulla: si rende tutto al primo frame.
 */
export function useIncrementalRender(
  total: number,
  { initial = 150, chunk = 150 }: { initial?: number; chunk?: number } = {}
): { count: number; isRendering: boolean } {
  const [count, setCount] = useState(() => Math.min(total, initial));
  const frame = useRef<number | null>(null);

  useEffect(() => {
    setCount(Math.min(total, initial));
  }, [total, initial]);

  useEffect(() => {
    if (count >= total) return;
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number;
    frame.current = raf(() => setCount((c) => Math.min(total, c + chunk))) as unknown as number;
    return () => {
      if (frame.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [count, total, chunk]);

  return { count, isRendering: count < total };
}
