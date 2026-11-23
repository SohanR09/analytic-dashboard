import anime from 'animejs';
import { useEffect, useRef, useState } from 'react';

const STEPS = ['Collecting orders', 'Crunching the numbers', 'Building tables', 'Finishing up'];
const EXPECTED_MS = 3400; // typical backend generation time
const BARS = [0.45, 0.75, 0.55, 0.95, 0.7];

/**
 * Waiting state shown while a report is generated (Anime.js).
 * Progress eases towards 90% over the expected duration and only reaches 100% when `done` flips,
 * so a slow backend never shows a "finished" bar. Respects reduced-motion.
 */
export function ReportGenerating({ done = false, label }: { done?: boolean; label?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState(0);
  const progress = useRef({ v: 0 });
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Looping illustration: bars grow in a stagger, the doc gently floats, lines shimmer.
  useEffect(() => {
    const el = root.current;
    if (!el || reduce) return;
    const anims = [
      anime({ targets: el.querySelectorAll('[data-bar]'), scaleY: [0.15, 1], delay: anime.stagger(120), duration: 700, easing: 'easeOutBack', direction: 'alternate', loop: true, endDelay: 250 }),
      anime({ targets: el.querySelector('[data-doc]'), translateY: [-3, 3], duration: 1400, easing: 'easeInOutSine', direction: 'alternate', loop: true }),
      anime({ targets: el.querySelectorAll('[data-line]'), opacity: [0.35, 1], delay: anime.stagger(180), duration: 600, easing: 'easeInOutSine', direction: 'alternate', loop: true }),
    ];
    return () => anims.forEach((a) => a.pause());
  }, [reduce]);

  // Progress: ease to 90% over the expected time; jump to 100% once the response is in.
  useEffect(() => {
    const p = progress.current;
    const a = anime({
      targets: p, v: done ? 100 : 90, duration: done ? 300 : EXPECTED_MS, easing: done ? 'easeOutQuad' : 'easeOutCubic',
      update: () => {
        setPct(p.v);
        setStep(Math.min(STEPS.length - 1, Math.floor((p.v / 90) * STEPS.length)));
        if (fill.current) fill.current.style.width = `${p.v}%`;
      },
    });
    return () => a.pause();
  }, [done]);

  return (
    <div ref={root} role="status" aria-live="polite" className="flex flex-col items-center gap-5 py-6 text-center sm:flex-row sm:text-left">
      <div data-doc className="relative h-24 w-20 shrink-0 rounded-lg border border-line bg-white p-2.5 shadow-card">
        <div data-line className="mb-1.5 h-1.5 w-10 rounded-full bg-primary/70" />
        <div data-line className="mb-3 h-1.5 w-7 rounded-full bg-primary/30" />
        <div className="flex h-10 items-end gap-1">
          {BARS.map((h, i) => (
            <div key={i} data-bar className="flex-1 origin-bottom rounded-sm" style={{ height: `${h * 100}%`, background: i % 2 ? 'rgb(var(--secondary))' : 'rgb(var(--primary))' }} />
          ))}
        </div>
      </div>
      <div className="w-full max-w-sm">
        <p className="font-semibold text-ink">{done ? 'Report ready' : label ?? 'Generating your report…'}</p>
        <p className="mt-0.5 text-sm text-muted">{done ? 'Opening it now' : `${STEPS[step]}…`}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-lightblue">
          <div ref={fill} className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: 0 }} />
        </div>
        <p className="mt-1.5 text-xs tabular-nums text-muted">{Math.round(pct)}%</p>
      </div>
    </div>
  );
}
