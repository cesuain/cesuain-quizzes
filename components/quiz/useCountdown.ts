"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Per-question countdown. It starts when the component mounts (players key the question card
 * by question id, so each question gets a fresh timer), pauses while `running` is false and
 * calls `onExpire` once when it reaches zero.
 */
export function useCountdown(seconds: number, running: boolean, onExpire: () => void) {
  const limitMs = seconds * 1000;
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!running || limitMs <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [running, limitMs]);

  const remainingMs = limitMs > 0 ? Math.max(0, limitMs - (now - startedAt)) : 0;

  useEffect(() => {
    if (running && limitMs > 0 && remainingMs === 0 && !expired.current) {
      expired.current = true;
      onExpireRef.current();
    }
  }, [running, limitMs, remainingMs]);

  return { enabled: limitMs > 0, remainingMs, percent: limitMs > 0 ? (remainingMs / limitMs) * 100 : 100 };
}
