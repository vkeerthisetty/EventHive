const KEY = 'eventhive_demo_registrations';

export interface DemoRegistration {
  id: string;
  eventId: string;
  secret: string;
  status: 'registered' | 'cancelled';
  createdAt: string;
  studentName?: string;
  checkedInAt?: string | null;
}

export function getDemoRegistrations(): DemoRegistration[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function getDemoRegistration(eventId: string): DemoRegistration | undefined {
  return getDemoRegistrations().find((item) => item.eventId === eventId && item.status === 'registered');
}

export function registerDemoEvent(eventId: string, studentName = 'Demo Student'): DemoRegistration {
  const existing = getDemoRegistration(eventId);
  if (existing) return existing;
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const registration: DemoRegistration = {
    id: `local-${crypto.randomUUID()}`,
    eventId,
    secret,
    status: 'registered',
    createdAt: new Date().toISOString(),
    studentName,
    checkedInAt: null,
  };
  localStorage.setItem(KEY, JSON.stringify([...getDemoRegistrations(), registration]));
  return registration;
}

export function checkInDemoRegistration(registrationId: string): DemoRegistration | undefined {
  const registrations = getDemoRegistrations();
  const registration = registrations.find(
    (item) => item.id === registrationId && item.status === 'registered'
  );
  if (!registration) return undefined;
  if (!registration.checkedInAt) {
    registration.checkedInAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(registrations));
    window.dispatchEvent(new Event('demo-registrations-updated'));
  }
  return registration;
}

export function cancelDemoRegistration(eventId: string): void {
  const registrations = getDemoRegistrations();
  const registration = registrations.find((item) => item.eventId === eventId && item.status === 'registered');
  if (registration) {
    registration.status = 'cancelled';
    localStorage.setItem(KEY, JSON.stringify(registrations));
  }
}
