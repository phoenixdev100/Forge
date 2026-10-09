import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, Plus, Timer, X } from 'lucide-react';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The rest timer is a floating pill that follows you through the workout.
 * It starts automatically when a set is completed, can be paused, extended,
 * or dismissed, and never blocks the set inputs underneath it.
 */

type RestTimerState = {
  /** Start (or restart) a countdown of `seconds`. */
  start: (seconds: number) => void;
  stop: () => void;
  running: boolean;
};

const RestTimerContext = createContext<RestTimerState | null>(null);

export function useRestTimer() {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used inside <RestTimerProvider>');
  return ctx;
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const endAtRef = useRef<number>(0);

  const stop = useCallback(() => {
    setTotal(0);
    setRemaining(0);
    setPaused(false);
  }, []);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    endAtRef.current = Date.now() + seconds * 1000;
    setTotal(seconds);
    setRemaining(seconds);
    setPaused(false);
  }, []);

  // Wall-clock based, so the timer is correct even if the phone locks the tab.
  useEffect(() => {
    if (!total || paused) return;
    const tick = () => {
      const left = Math.round((endAtRef.current - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        setTotal(0);
        // A short vibration is the gym-appropriate signal; harmless elsewhere.
        try {
          navigator.vibrate?.([120, 60, 120]);
        } catch {
          /* vibration is best-effort */
        }
      } else {
        setRemaining(left);
      }
    };
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [total, paused]);

  const extend = (seconds: number) => {
    const base = paused ? remaining * 1000 : endAtRef.current - Date.now();
    const next = Math.max(1, Math.round((base + seconds * 1000) / 1000));
    endAtRef.current = Date.now() + next * 1000;
    setTotal(next);
    setRemaining(next);
    setPaused(false);
  };

  const running = total > 0;
  const pct = total ? remaining / total : 0;

  return (
    <RestTimerContext.Provider value={{ start, stop, running }}>
      {children}
      <AnimatePresence>
        {running ? (
          <motion.div
            key="rest-timer"
            role="timer"
            aria-label={`Rest timer, ${formatClock(remaining)} remaining`}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-20 z-40 mx-auto w-fit max-w-[calc(100vw-2rem)] lg:bottom-6"
          >
            <div className="relative flex items-center gap-2 overflow-hidden rounded-full border border-border bg-surface-raised py-1.5 pr-1.5 pl-4 shadow-[var(--shadow-overlay)]">
              {/* Draining progress ring behind the time */}
              <div
                className="absolute inset-y-0 left-0 bg-accent/10 transition-[width] duration-500 ease-linear"
                style={{ width: `${pct * 100}%` }}
                aria-hidden
              />
              <Timer className="relative size-4 shrink-0 text-accent" aria-hidden />
              <span className={cn('tnum relative text-lg font-semibold', remaining <= 10 ? 'text-danger' : 'text-text')}>
                {formatClock(remaining)}
              </span>
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => extend(30)}
                  className="flex h-9 items-center gap-0.5 rounded-full px-2.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                >
                  <Plus className="size-3.5" aria-hidden /> 30s
                </button>
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? 'Resume rest timer' : 'Pause rest timer'}
                  className="flex size-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                >
                  {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                </button>
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Dismiss rest timer"
                  className="flex size-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </RestTimerContext.Provider>
  );
}
