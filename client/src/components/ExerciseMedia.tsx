import { useEffect, useRef, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ExerciseMedia as Media } from '@/lib/types';

/**
 * Renders an exercise demonstration.
 *
 * The seed library is public-domain stills captured at two key positions of
 * each movement. Cross-fading between them produces a silent, auto-playing
 * loop that actually communicates the movement - no licensed video required -
 * and real `<video>` clips are supported for when media is uploaded later.
 *
 * Performance rules enforced here, because an exercise grid can hold 50 cards:
 *   - nothing loads until the card is near the viewport (IntersectionObserver)
 *   - only the poster loads at first; the second frame loads after it is visible
 *   - the loop only animates while on screen
 *   - `prefers-reduced-motion` collapses it to a single static frame
 */
export function ExerciseMedia({
  media,
  name,
  className,
  /** `card` loops on hover/visible; `detail` always loops; `thumb` stays static. */
  mode = 'card',
  rounded = true,
}: {
  media: Media | null | undefined;
  name: string;
  className?: string;
  mode?: 'thumb' | 'card' | 'detail';
  rounded?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [secondFrameReady, setSecondFrameReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // `rootMargin` starts the fetch just before the card scrolls into view, so
    // images are already decoded by the time they are on screen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const frames = media?.frames ?? [];
  const poster = media?.posterUrl ?? frames[0] ?? null;
  const secondFrame = frames.length > 1 ? frames[1] : null;
  const shouldLoop = mode !== 'thumb' && media?.canAnimate === true;

  // Only pull the second frame once the first has painted - it is pure polish
  // and must never compete with the content the user is already looking at.
  useEffect(() => {
    if (!shouldLoop || !secondFrame || !posterLoaded) return;
    const image = new Image();
    image.src = secondFrame;
    image.decoding = 'async';
    image.onload = () => setSecondFrameReady(true);
  }, [shouldLoop, secondFrame, posterLoaded]);

  const radius = rounded ? 'rounded-[var(--radius-control)]' : '';

  if (!poster || failed) {
    return (
      <div
        ref={containerRef}
        className={cn('flex items-center justify-center bg-surface-inset text-text-subtle', radius, className)}
        role="img"
        aria-label={`No demonstration available for ${name}`}
      >
        <Dumbbell className="size-1/4 max-h-10 min-h-5 opacity-40" aria-hidden />
      </div>
    );
  }

  // A real uploaded clip takes priority over the two-frame loop.
  if (media?.isVideo && media.loopUrl && mode !== 'thumb') {
    return (
      <div ref={containerRef} className={cn('relative overflow-hidden bg-surface-inset', radius, className)}>
        {isVisible ? (
          <video
            src={media.loopUrl}
            poster={poster}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            // No controls: it is a silent demonstration, not a video to watch.
            disablePictureInPicture
            aria-label={`${name} demonstration`}
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <img src={poster} alt="" className="size-full object-cover" loading="lazy" />
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden bg-surface-inset', radius, className)}
      role="img"
      aria-label={`${name} demonstration`}
    >
      {isVisible ? (
        <>
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              'size-full object-cover transition-opacity duration-300',
              posterLoaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => setPosterLoaded(true)}
            onError={() => setFailed(true)}
          />
          {shouldLoop && secondFrame && secondFrameReady ? (
            <img
              src={secondFrame}
              alt=""
              aria-hidden
              className={cn(
                'absolute inset-0 size-full object-cover',
                mode === 'detail' || mode === 'card' ? 'animate-frame-cycle' : 'opacity-0',
              )}
            />
          ) : null}
        </>
      ) : (
        <div className="skeleton size-full" aria-hidden />
      )}
    </div>
  );
}
