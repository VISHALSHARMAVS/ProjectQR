import { useEffect, useRef, useState } from 'react';

interface TaglineRevealProps {
  eyebrow?: string;
  tagline?: string;
}

export function TaglineReveal({
  eyebrow = 'The hospitality philosophy',
  tagline = 'Hospitality belongs at the dining table, not at the billing counter. Give your staff their time back while every table turns faster.'
}: TaglineRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const words = tagline.split(' ');
  const [progress, setProgress] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? words.length
      : 0
  );

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    let timer: number | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          let current = 0;
          timer = window.setInterval(() => {
            current += 1;
            setProgress(current);
            if (current >= words.length && timer) {
              window.clearInterval(timer);
            }
          }, 40); // 40ms stagger per word on base decelerating curve
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timer) window.clearInterval(timer);
    };
  }, [words.length]);

  return (
    <section
      ref={containerRef}
      className="page-wrap"
      style={{
        padding: '80px 0',
        textAlign: 'center',
        maxWidth: 680,
        margin: '0 auto'
      }}
    >
      <span className="pill green" style={{ fontSize: 12, fontWeight: 600, display: 'inline-block', marginBottom: 16 }}>
        {eyebrow}
      </span>
      <h2
        className="heading-2"
        style={{
          fontSize: 'clamp(28px, 4.5vw, 42px)',
          lineHeight: 1.25,
          letterSpacing: '-0.03em',
          margin: 0
        }}
      >
        {words.map((word, idx) => {
          const isRevealed = idx < progress;
          return (
            <span key={idx}>
              <span
                style={{
                  display: 'inline-block',
                  transition: 'color 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms cubic-bezier(0.22, 1, 0.36, 1)',
                  color: isRevealed ? 'var(--ink)' : 'var(--muted)',
                  opacity: isRevealed ? 1 : 0.28
                }}
              >
                {word}
              </span>
              {idx < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </h2>
    </section>
  );
}
