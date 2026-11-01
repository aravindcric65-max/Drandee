import { useState, useEffect } from 'react';

export function useRelativeTime(dateString) {
  const [relativeTime, setRelativeTime] = useState('');

  useEffect(() => {
    if (!dateString) return;

    const updateTime = () => {
      // Accept Date objects directly, or parse ISO strings
      const date = dateString instanceof Date ? dateString : new Date(
        typeof dateString === 'string' && !dateString.includes('Z') && !dateString.includes('+')
          ? dateString.replace(' ', 'T') + 'Z'
          : dateString
      );
      if (isNaN(date.getTime())) return;
      const now = new Date();

      // Ensure we don't calculate negative time for slight clock drift
      const diffInSeconds = Math.max(0, Math.floor((now - date) / 1000));

      if (diffInSeconds < 60) {
        setRelativeTime('just now');
      } else if (diffInSeconds < 3600) {
        const mins = Math.floor(diffInSeconds / 60);
        setRelativeTime(`${mins}m`);
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        setRelativeTime(`${hours}h`);
      } else {
        const days = Math.floor(diffInSeconds / 86400);
        setRelativeTime(`${days}d`);
      }
    };

    updateTime();

    // Update every minute
    const intervalId = setInterval(updateTime, 60000);

    return () => clearInterval(intervalId);
  }, [dateString]);

  return relativeTime;
}
