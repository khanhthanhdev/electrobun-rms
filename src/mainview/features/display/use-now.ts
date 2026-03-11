import { useEffect, useState } from "react";

/**
 * Returns the current Date, updating every `tickMs` milliseconds.
 * Useful for live clocks and countdown timers.
 */
export const useNow = (tickMs = 1000): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, tickMs);

    return () => {
      window.clearInterval(id);
    };
  }, [tickMs]);

  return now;
};
