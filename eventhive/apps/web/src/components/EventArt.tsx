import React, { useMemo } from 'react';
import { buildArt } from '@eventhive/shared';

interface EventArtProps {
  eventId: string;
  category: string;
  className?: string;
}

export const EventArt: React.FC<EventArtProps> = ({ eventId, category, className = '' }) => {
  const svgString = useMemo(() => {
    return buildArt(eventId || 'default-id', category || 'technical');
  }, [eventId, category]);

  return (
    <div
      className={`overflow-hidden flex items-center justify-center ${className}`}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};
