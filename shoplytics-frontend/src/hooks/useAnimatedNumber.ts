import anime from 'animejs';
import { useEffect, useRef, useState } from 'react';

/** Count-up animation (Anime.js) used by the dashboard stat cards. Respects reduced-motion. */
export function useAnimatedNumber(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const last = useRef(target);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setValue(target); last.current = target; return; }
    const o = { v: last.current };
    const a = anime({ targets: o, v: target, duration, easing: 'easeOutCubic', update: () => setValue(o.v), complete: () => { last.current = target; } });
    return () => a.pause();
  }, [target, duration]);
  return value;
}
