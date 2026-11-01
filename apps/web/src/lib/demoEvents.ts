const STORAGE_KEY = 'eventhive_demo_events';

export interface DemoEvent {
  id: string;

  title: string;
  description: string;
  category: string;

  starts_at: string;
  ends_at: string;

  startsAt?: string;
  endsAt?: string;

  venue_name: string;
  venueName?: string;

  organizer_name: string;

  capacity: number;

  confirmedCount: number;
  seatsLeft: number;

  status: string;

  is_paid: boolean;
  price_inr: number;

  accessibility: string[];
  dietary: string[];
  tags: string[];

  banner_url: string;

  is_team_event: boolean;

  venue_step_free: boolean;

  created_at: string;
}

export type CreateDemoEventInput = Omit<
  DemoEvent,
  | 'id'
  | 'created_at'
  | 'confirmedCount'
  | 'seatsLeft'
>;

export const getDemoEvents = (): DemoEvent[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const events = JSON.parse(stored);

    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
};

export const createDemoEvent = (
  eventData: CreateDemoEventInput
): DemoEvent => {
  const newEvent: DemoEvent = {
    ...eventData,

    id: `demo-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`,

    confirmedCount: 0,
    seatsLeft: Number(eventData.capacity),

    created_at: new Date().toISOString(),
  };

  const existingEvents = getDemoEvents();

  const updatedEvents = [newEvent, ...existingEvents];

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updatedEvents)
  );

  return newEvent;
};

export const getDemoEventById = (
  id: string
): DemoEvent | null => {
  const events = getDemoEvents();

  return events.find((event) => event.id === id) || null;
};

export const updateDemoEvent = (
  id: string,
  updates: Partial<DemoEvent>
): DemoEvent | null => {
  const events = getDemoEvents();

  const eventIndex = events.findIndex(
    (event) => event.id === id
  );

  if (eventIndex === -1) {
    return null;
  }

  const updatedEvent = {
    ...events[eventIndex],
    ...updates,
  };

  events[eventIndex] = updatedEvent;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(events)
  );

  return updatedEvent;
};

export const deleteDemoEvent = (id: string): boolean => {
  const events = getDemoEvents();

  const updatedEvents = events.filter(
    (event) => event.id !== id
  );

  if (updatedEvents.length === events.length) {
    return false;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updatedEvents)
  );

  return true;
};