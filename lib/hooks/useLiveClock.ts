import { useEffect, useState } from "react";

/** Horloge UI pour refiltrer le LIVE expiré sans attendre un event Realtime. */
export function useLiveClock(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
