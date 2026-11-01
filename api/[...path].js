const DAY = 24 * 60 * 60 * 1000;
const INDIA_OFFSET_MINUTES = 330;

// Keep demo event times in India Standard Time, even when Vercel runs in UTC.
function at(daysFromToday, hour, durationHours = 2) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());

  const dateParts = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  const startMs = Date.UTC(
    Number(dateParts.year),
    Number(dateParts.month) - 1,
    Number(dateParts.day) + daysFromToday,
    hour,
    0,
    0
  ) - INDIA_OFFSET_MINUTES * 60 * 1000;

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + durationHours * 60 * 60 * 1000).toISOString(),
  };
}

function dateBoundaryInIndia(value, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;

  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  const timestamp = Date.parse(`${value}T${time}+05:30`);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsed) || parsed < 1) return fallback;

  return Math.min(parsed, max);
}

const slots = {
  web3: at(2, 10, 3),
  code: at(3, 9, 3),
  cloud: at(4, 11, 3),
  hack: at(10, 10, 24),
  mixer: at(6, 17, 3),
  design: at(8, 14, 3),
  football: at(5, 16, 2),
  ai: at(12, 10, 2),
  cultural: at(14, 18, 3),
  seminar: at(16, 11, 2),
  past: at(-3, 14, 2),
};

function makeEvent(options) {
  const time = slots[options.slot];

  return {
    id: options.id,
    title: options.title,
    description: options.description,
    category: options.category,
    starts_at: time.start,
    ends_at: time.end,
    venue_id: options.venueId,
    venue_name: options.venueName,
    venue_step_free: options.stepFree,
    organizer_name: options.organizer,
    capacity: options.capacity,
    confirmedCount: options.confirmed,
    seatsLeft: Math.max(0, options.capacity - options.confirmed),
    registration_deadline: new Date(
      new Date(time.start).getTime() - DAY
    ).toISOString(),
    banner_url: null,
    is_paid: options.paid,
    price_inr: options.price,
    status: options.status || 'published',
    accessibility: options.accessibility,
    dietary: options.dietary,
    tags: options.tags,
    is_team_event: options.teamEvent || false,
    team_min: options.teamMin ?? null,
    team_max: options.teamMax ?? null,
  };
}

const events = [
  makeEvent({
    id: 'web3-basics-bootcamp',
    title: 'Web3 Basics Bootcamp',
    description: 'A hands-on introduction to blockchain, smart contracts, Solidity, and modern Web3 development. Bring your laptop and build your first small decentralized application with guidance from the campus tech club.',
    category: 'technical',
    slot: 'web3',
    venueId: 'cs-lab-1',
    venueName: 'CS Lab 1',
    stepFree: true,
    organizer: 'Tech Club Organizer',
    capacity: 60,
    confirmed: 48,
    paid: false,
    price: 0,
    accessibility: ['step_free', 'seating_available'],
    dietary: ['veg'],
    tags: ['web3', 'blockchain', 'solidity'],
  }),

  makeEvent({
    id: 'competitive-coding-contest',
    title: 'Competitive Coding Contest',
    description: 'Test your algorithmic problem-solving skills in a timed individual coding contest. Problems range from beginner-friendly to advanced, with a live leaderboard and prizes for top performers.',
    category: 'technical',
    slot: 'code',
    venueId: 'cs-lab-2',
    venueName: 'CS Lab 2',
    stepFree: false,
    organizer: 'Tech Club Organizer',
    capacity: 60,
    confirmed: 57,
    paid: false,
    price: 0,
    accessibility: ['seating_available'],
    dietary: [],
    tags: ['coding', 'algorithms', 'competitive-programming'],
  }),

  makeEvent({
    id: 'cloud-hands-on-day',
    title: 'Cloud Hands-on Day',
    description: 'Explore practical cloud engineering through guided sessions on containers, Kubernetes, Terraform, and scalable application architecture.',
    category: 'technical',
    slot: 'cloud',
    venueId: 'seminar-hall-b',
    venueName: 'Seminar Hall B',
    stepFree: true,
    organizer: 'Tech Club Organizer',
    capacity: 80,
    confirmed: 41,
    paid: false,
    price: 0,
    accessibility: ['step_free', 'seating_available'],
    dietary: ['veg'],
    tags: ['cloud', 'kubernetes', 'terraform'],
  }),

  makeEvent({
    id: 'codestorm-24h-hackathon',
    title: 'CodeStorm 24h Hackathon',
    description: 'A 24-hour campus hackathon where teams build prototype solutions for real-world problems. Collaborate, learn from mentors, and present your final project to the judging panel.',
    category: 'hackathon',
    slot: 'hack',
    venueId: 'innovation-hub',
    venueName: 'Innovation Hub',
    stepFree: true,
    organizer: 'Tech Club Organizer',
    capacity: 100,
    confirmed: 82,
    paid: false,
    price: 0,
    accessibility: ['step_free', 'seating_available', 'quiet_room'],
    dietary: ['veg', 'vegan'],
    tags: ['hackathon', 'team', 'innovation'],
    teamEvent: true,
    teamMin: 2,
    teamMax: 4,
  }),

  makeEvent({
    id: 'full-house-mixer',
    title: 'Full House Mixer',
    description: 'Meet students from across campus through games, refreshments, and guided networking activities in a relaxed social setting.',
    category: 'social',
    slot: 'mixer',
    venueId: 'open-air-theatre',
    venueName: 'Open Air Theatre',
    stepFree: false,
    organizer: 'Cultural Society',
    capacity: 30,
    confirmed: 30,
    paid: false,
    price: 0,
    accessibility: ['seating_available'],
    dietary: ['veg'],
    tags: ['social', 'networking', 'games'],
  }),

  makeEvent({
    id: 'poster-design-workshop',
    title: 'Poster Design Workshop',
    description: 'Learn practical visual communication, layout, typography, and composition techniques for creating effective event posters and social media graphics.',
    category: 'workshop',
    slot: 'design',
    venueId: 'innovation-hub',
    venueName: 'Innovation Hub',
    stepFree: true,
    organizer: 'Cultural Society',
    capacity: 50,
    confirmed: 35,
    paid: false,
    price: 0,
    accessibility: ['step_free', 'seating_available'],
    dietary: ['veg'],
    tags: ['design', 'poster', 'creative'],
  }),

  makeEvent({
    id: 'campus-football-cup',
    title: 'Campus Football Cup',
    description: 'An inter-department football tournament featuring campus teams and a knockout format. Come play or support your department from the stands.',
    category: 'sports',
    slot: 'football',
    venueId: 'sports-ground',
    venueName: 'Sports Ground',
    stepFree: false,
    organizer: 'Sports Council',
    capacity: 200,
    confirmed: 150,
    paid: false,
    price: 0,
    accessibility: ['seating_available'],
    dietary: [],
    tags: ['football', 'sports', 'tournament'],
    teamEvent: true,
    teamMin: 5,
    teamMax: 11,
  }),

  makeEvent({
    id: 'ai-for-everyone',
    title: 'AI for Everyone',
    description: 'A beginner-friendly seminar on modern artificial intelligence, machine learning applications, responsible AI, and how students can start building useful projects.',
    category: 'seminar',
    slot: 'ai',
    venueId: 'main-auditorium',
    venueName: 'Main Auditorium',
    stepFree: true,
    organizer: 'Tech Club Organizer',
    capacity: 300,
    confirmed: 180,
    paid: true,
    price: 99,
    accessibility: ['step_free', 'seating_available', 'captioning'],
    dietary: ['veg', 'vegan'],
    tags: ['ai', 'machine-learning', 'technology'],
  }),

  makeEvent({
    id: 'campus-cultural-night',
    title: 'Campus Cultural Night',
    description: 'An evening of music, dance, theatre, and student performances celebrating the creativity and diversity of campus life.',
    category: 'cultural',
    slot: 'cultural',
    venueId: 'open-air-theatre',
    venueName: 'Open Air Theatre',
    stepFree: false,
    organizer: 'Cultural Society',
    capacity: 500,
    confirmed: 420,
    paid: true,
    price: 149,
    accessibility: ['seating_available'],
    dietary: ['veg'],
    tags: ['culture', 'music', 'dance'],
  }),

  makeEvent({
    id: 'research-methods-seminar',
    title: 'Research Methods Seminar',
    description: 'Learn how to frame research questions, evaluate sources, design a study, and present academic findings clearly.',
    category: 'seminar',
    slot: 'seminar',
    venueId: 'seminar-hall-a',
    venueName: 'Seminar Hall A',
    stepFree: true,
    organizer: 'Tech Club Organizer',
    capacity: 120,
    confirmed: 64,
    paid: false,
    price: 0,
    accessibility: ['step_free', 'seating_available'],
    dietary: ['veg'],
    tags: ['research', 'academic', 'seminar'],
  }),

  makeEvent({
    id: 'open-mic-night',
    title: 'Open Mic Night',
    description: 'Poetry, acoustic music, stand-up comedy, and student performances from across campus.',
    category: 'cultural',
    slot: 'past',
    venueId: 'main-auditorium',
    venueName: 'Main Auditorium',
    stepFree: true,
    organizer: 'Cultural Society',
    capacity: 80,
    confirmed: 74,
    paid: false,
    price: 0,
    status: 'completed',
    accessibility: ['step_free', 'seating_available'],
    dietary: ['veg'],
    tags: ['music', 'poetry', 'comedy'],
  }),
];

function toListEvent(event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    venueId: event.venue_id,
    venueName: event.venue_name,
    venueStepFree: event.venue_step_free,
    capacity: event.capacity,
    registrationDeadline: event.registration_deadline,
    bannerUrl: event.banner_url,
    isPaid: event.is_paid,
    priceInr: event.price_inr,
    status: event.status,
    accessibility: event.accessibility,
    dietary: event.dietary,
    tags: event.tags,
    confirmedCount: event.confirmedCount,
    seatsLeft: event.seatsLeft,
    isFillingFast: event.capacity > 0 &&
      event.confirmedCount / event.capacity >= 0.8,
  };
}

function sendJson(res, status, body, method = 'GET') {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');

  return res.end(
    method === 'HEAD' ? undefined : JSON.stringify(body)
  );
}

function filterEvents(params) {
  const q = (params.get('q') || '').trim().toLowerCase();
  const categories = params.getAll('category');
  const accessibility = params.getAll('accessibility');
  const dietary = params.getAll('dietary');
  const venue = params.get('venue') || '';
  const free = params.get('free');
  const from = params.get('from');
  const to = params.get('to');
  const showPast = params.get('showPast') === 'true';
  const sort = params.get('sort') || 'soonest';

  const fromTime = from ? dateBoundaryInIndia(from, false) : null;
  const toTime = to ? dateBoundaryInIndia(to, true) : null;
  const now = Date.now();

  const filtered = events.filter((event) => {
    const haystack =
      `${event.title} ${event.description} ${event.tags.join(' ')}`
        .toLowerCase();

    const eventStart = new Date(event.starts_at).getTime();
    const eventEnd = new Date(event.ends_at).getTime();

    if (q && !haystack.includes(q)) return false;
    if (categories.length && !categories.includes(event.category)) return false;

    if (
      accessibility.length &&
      !accessibility.some((item) => event.accessibility.includes(item))
    ) return false;

    if (
      dietary.length &&
      !dietary.some((item) => event.dietary.includes(item))
    ) return false;

    if (venue && event.venue_id !== venue) return false;
    if (free === 'true' && event.is_paid) return false;

    if (
      free === 'false' &&
      !(event.is_paid && Number(event.price_inr) > 0)
    ) return false;

    if (showPast) {
      if (!['published', 'completed'].includes(event.status)) return false;
    } else if (event.status !== 'published' || eventEnd <= now) {
      return false;
    }

    if (fromTime !== null && eventStart < fromTime) return false;
    if (toTime !== null && eventStart > toTime) return false;

    return true;
  });

  if (sort === 'newest') {
    filtered.sort((a, b) =>
      new Date(b.starts_at).getTime() -
      new Date(a.starts_at).getTime()
    );
  } else if (sort === 'popular') {
    filtered.sort((a, b) =>
      b.confirmedCount - a.confirmedCount ||
      new Date(a.starts_at).getTime() -
      new Date(b.starts_at).getTime()
    );
  } else {
    filtered.sort((a, b) =>
      new Date(a.starts_at).getTime() -
      new Date(b.starts_at).getTime()
    );
  }

  return filtered;
}

function makeCalendarFile(event) {
  const stamp = (value) =>
    new Date(value).toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');

  const escape = (value) => String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventHive//Campus Events//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@eventhive`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(event.ends_at)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(event.description)}`,
    `LOCATION:${escape(event.venue_name)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// Demo-only registrations are stored in a browser cookie. They are intentionally
// not a database and are suitable only for this Vercel demo.
const DEMO_USER = {
  id: 'demo-student',
  name: 'Demo Student',
  email: 'demo@student.eventhive.local',
  role: 'student',
  department: 'Computer Science',
  year: 3,
};

function parseCookies(req) {
  const raw = req.headers.cookie || '';

  return Object.fromEntries(
    raw.split(';')
      .map((part) => {
        const index = part.indexOf('=');

        if (index === -1) {
          return [part.trim(), ''];
        }

        return [
          part.slice(0, index).trim(),
          part.slice(index + 1).trim(),
        ];
      })
      .filter(([key]) => key)
  );
}

function getDemoRegistrations(req) {
  try {
    const cookies = parseCookies(req);
    const raw = cookies.eh_demo_regs;

    if (!raw) return [];

    const value = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8')
    );

    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
}

function setDemoRegistrations(res, registrations) {
  const value = Buffer.from(
    JSON.stringify(registrations),
    'utf8'
  ).toString('base64url');

  res.setHeader(
    'set-cookie',
    `eh_demo_regs=${value}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
  );
}

function demoRegistrationId(eventId) {
  return `demo-${eventId}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDemoRegistration(req, eventId) {
  return (
    getDemoRegistrations(req).find(
      (item) =>
        item.eventId === eventId &&
        item.status !== 'cancelled'
    ) || null
  );
}

function registrationPayload(registration) {
  return {
    id: registration.id,
    registration_id: registration.id,
    event_id: registration.eventId,
    status: registration.status,
    waitlistPosition: registration.waitlistPosition || null,
    checked_in_at: null,
  };
}

function demoClashes(req, eventId) {
  const event = events.find((item) => item.id === eventId);

  if (!event) return [];

  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();

  return getDemoRegistrations(req)
    .filter(
      (registration) =>
        registration.status === 'registered' &&
        registration.eventId !== eventId
    )
    .map((registration) =>
      events.find((item) => item.id === registration.eventId)
    )
    .filter(Boolean)
    .filter((other) =>
      start < new Date(other.ends_at).getTime() &&
      end > new Date(other.starts_at).getTime()
    )
    .map((other) => ({
      id: other.id,
      title: other.title,
      starts_at: other.starts_at,
      ends_at: other.ends_at,
      venue_name: other.venue_name,
    }));
}

// Keep the original proxy as a fallback for routes not yet converted to demo mode.
async function proxyToOriginalBackend(req, res) {
  const base = (process.env.API_BACKEND_URL || '').replace(/\/$/, '');

  if (!base) {
    return sendJson(res, 503, {
      error: {
        code: 'API_NOT_CONFIGURED',
        message: 'This API route still needs the optional API_BACKEND_URL backend. Public event listing and details do not need it.',
      },
    }, req.method);
  }

  try {
    const target = `${base}${req.url || '/'}`;
    const headers = { ...req.headers };

    delete headers.host;
    delete headers['content-length'];

    const init = {
      method: req.method,
      headers,
      redirect: 'manual',
    };

    if (
      !['GET', 'HEAD'].includes(req.method || 'GET') &&
      req.body !== undefined
    ) {
      init.body =
        typeof req.body === 'string' || Buffer.isBuffer(req.body)
          ? req.body
          : JSON.stringify(req.body);
    }

    const upstream = await fetch(target, init);

    res.statusCode = upstream.status;

    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        res.setHeader(key, value);
      }
    });

    if (typeof upstream.headers.getSetCookie === 'function') {
      const cookies = upstream.headers.getSetCookie();

      if (cookies.length) {
        res.setHeader('set-cookie', cookies);
      }
    } else {
      const cookie = upstream.headers.get('set-cookie');

      if (cookie) {
        res.setHeader('set-cookie', cookie);
      }
    }

    const responseBody = Buffer.from(await upstream.arrayBuffer());

    return res.end(responseBody);
  } catch (_error) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');

    return res.end(JSON.stringify({
      error: {
        code: 'API_PROXY_FAILED',
        message: 'Unable to reach the configured EventHive API backend.',
      },
    }));
  }
}

module.exports = async function handler(req, res) {
  const url = new URL(
    req.url || '/',
    `https://${req.headers.host || 'localhost'}`
  );

  const path = url.pathname;
  const params = url.searchParams;
  const method = String(req.method || 'GET').toUpperCase();

  const isEventList = path === '/api/events';
  const isFilterMetadata = path === '/api/events/filters/meta';

  const calendarMatch = path.match(
    /^\/api\/events\/([^/]+)\/calendar\.ics$/
  );

  const detailMatch = path.match(
    /^\/api\/events\/([^/]+)$/
  );

  const isLocalEventReadRoute =
    isEventList ||
    isFilterMetadata ||
    Boolean(calendarMatch) ||
    Boolean(detailMatch);

  // Demo authentication so the existing frontend can register without an external backend.
  if (
    path === '/api/auth/me' &&
    ['GET', 'HEAD'].includes(method)
  ) {
    return sendJson(res, 200, { user: DEMO_USER }, method);
  }

  if (
    ['/api/auth/login', '/api/auth/signup'].includes(path) &&
    method === 'POST'
  ) {
    return sendJson(
      res,
      200,
      { user: DEMO_USER, demo: true },
      method
    );
  }

  if (
    path === '/api/auth/logout' &&
    method === 'POST'
  ) {
    res.setHeader(
      'set-cookie',
      'eh_demo_regs=; Path=/; Max-Age=0; SameSite=Lax; Secure'
    );

    return sendJson(res, 200, { ok: true }, method);
  }

  if (
    path === '/api/me/clashes' &&
    ['GET', 'HEAD'].includes(method)
  ) {
    return sendJson(
      res,
      200,
      {
        clashes: demoClashes(
          req,
          params.get('eventId')
        ),
      },
      method
    );
  }

  if (
    path === '/api/me/events' &&
    ['GET', 'HEAD'].includes(method)
  ) {
    const tab = params.get('tab') || 'upcoming';
    const now = Date.now();

    const items = getDemoRegistrations(req)
      .map((registration) => ({
        registration,
        event: events.find(
          (item) => item.id === registration.eventId
        ),
      }))
      .filter(({ event }) => Boolean(event))
      .filter(({ registration, event }) => {
        if (tab === 'waitlisted') {
          return registration.status === 'waitlisted';
        }

        if (tab === 'cancelled') {
          return registration.status === 'cancelled';
        }

        if (tab === 'past') {
          return new Date(event.ends_at).getTime() <= now;
        }

        return (
          registration.status === 'registered' &&
          new Date(event.ends_at).getTime() > now
        );
      })
      .map(({ registration, event }) => ({
        registration_id: registration.id,
        event_id: event.id,
        title: event.title,
        category: event.category,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        venue_name: event.venue_name,
        waitlistPosition:
          registration.waitlistPosition || null,
        checked_in_at: null,
      }));

    return sendJson(res, 200, { items }, method);
  }

  const registerMatch = path.match(
    /^\/api\/events\/([^/]+)\/register$/
  );

  if (registerMatch && method === 'POST') {
    let eventId;

    try {
      eventId = decodeURIComponent(registerMatch[1]);
    } catch (_error) {
      eventId = '';
    }

    const event = events.find(
      (item) => item.id === eventId
    );

    if (!event) {
      return sendJson(res, 404, {
        error: {
          code: 'EVENT_NOT_FOUND',
          message: 'Event not found.',
        },
      }, method);
    }

    const now = Date.now();

    if (
      event.status !== 'published' ||
      new Date(event.ends_at).getTime() <= now
    ) {
      return sendJson(res, 400, {
        error: {
          code: 'EVENT_UNAVAILABLE',
          message:
            'This event is no longer available for registration.',
        },
      }, method);
    }

    if (
      new Date(event.registration_deadline).getTime() <= now
    ) {
      return sendJson(res, 400, {
        error: {
          code: 'REGISTRATION_CLOSED',
          message:
            'Registration is closed for this event.',
        },
      }, method);
    }

    const registrations = getDemoRegistrations(req);

    const existing = registrations.find(
      (item) =>
        item.eventId === eventId &&
        item.status !== 'cancelled'
    );

    if (existing) {
      return sendJson(res, 200, {
        registration: registrationPayload(existing),
        alreadyRegistered: true,
      }, method);
    }

    const clashes = demoClashes(req, eventId);

    const status =
      event.confirmedCount >= event.capacity
        ? 'waitlisted'
        : 'registered';

    const registration = {
      id: demoRegistrationId(eventId),
      eventId,
      status,
      waitlistPosition:
        status === 'waitlisted' ? 1 : null,
      createdAt: new Date().toISOString(),
      clashes,
    };

    registrations.push(registration);

    setDemoRegistrations(res, registrations);

    return sendJson(res, 201, {
      registration: registrationPayload(registration),
      demo: true,
    }, method);
  }

  const cancelMatch = path.match(
    /^\/api\/events\/([^/]+)\/cancel$/
  );

  if (cancelMatch && method === 'POST') {
    let eventId;

    try {
      eventId = decodeURIComponent(cancelMatch[1]);
    } catch (_error) {
      eventId = '';
    }

    const registrations = getDemoRegistrations(req);

    const index = registrations.findIndex(
      (item) =>
        item.eventId === eventId &&
        item.status !== 'cancelled'
    );

    if (index === -1) {
      return sendJson(res, 404, {
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message:
            'No active registration found.',
        },
      }, method);
    }

    registrations[index].status = 'cancelled';
    registrations[index].cancelledAt =
      new Date().toISOString();

    setDemoRegistrations(res, registrations);

    return sendJson(
      res,
      200,
      { ok: true },
      method
    );
  }

  const qrMatch = path.match(
    /^\/api\/registrations\/([^/]+)\/qr-secret$/
  );

  if (
    qrMatch &&
    ['GET', 'HEAD'].includes(method)
  ) {
    let registrationId;

    try {
      registrationId = decodeURIComponent(qrMatch[1]);
    } catch (_error) {
      registrationId = '';
    }

    const registration = getDemoRegistrations(req).find(
      (item) =>
        item.id === registrationId &&
        item.status === 'registered'
    );

    if (!registration) {
      return sendJson(res, 404, {
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Ticket not found.',
        },
      }, method);
    }

    const event = events.find(
      (item) => item.id === registration.eventId
    );

    const secret = Buffer.from(
      `eventhive-demo:${registration.id}:${registration.eventId}`
    )
      .toString('hex')
      .slice(0, 64);

    return sendJson(res, 200, {
      secret,
      studentName: DEMO_USER.name,
      eventTitle:
        event ? event.title : 'EventHive Event',
    }, method);
  }

  if (
    !isLocalEventReadRoute ||
    !['GET', 'HEAD'].includes(method)
  ) {
    return proxyToOriginalBackend(req, res);
  }

  if (isFilterMetadata) {
    const venues = [
      ...new Map(
        events.map(
          (event) => [
            event.venue_id,
            event.venue_name,
          ]
        )
      ).entries(),
    ]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    return sendJson(
      res,
      200,
      { venues },
      method
    );
  }

  if (isEventList) {
    const filtered = filterEvents(params);

    const pageSize = positiveInteger(
      params.get('pageSize'),
      12,
      50
    );

    const page = positiveInteger(
      params.get('page'),
      1
    );

    const total = filtered.length;
    const start = (page - 1) * pageSize;

    const items = filtered
      .slice(start, start + pageSize)
      .map(toListEvent);

    return sendJson(
      res,
      200,
      {
        items,
        page,
        pageSize,
        total,
      },
      method
    );
  }

  if (calendarMatch) {
    let eventId;

    try {
      eventId = decodeURIComponent(calendarMatch[1]);
    } catch (_error) {
      return sendJson(res, 400, {
        error: {
          code: 'INVALID_EVENT_ID',
          message: 'Invalid event ID.',
        },
      }, method);
    }

    const event = events.find(
      (item) => item.id === eventId
    );

    if (!event) {
      return sendJson(res, 404, {
        error: {
          code: 'EVENT_NOT_FOUND',
          message: 'Event not found.',
        },
      }, method);
    }

    res.statusCode = 200;
    res.setHeader(
      'content-type',
      'text/calendar; charset=utf-8'
    );

    res.setHeader(
      'content-disposition',
      `attachment; filename="event-${event.id}.ics"`
    );

    return res.end(
      method === 'HEAD'
        ? undefined
        : makeCalendarFile(event)
    );
  }

  if (detailMatch) {
    let eventId;

    try {
      eventId = decodeURIComponent(detailMatch[1]);
    } catch (_error) {
      return sendJson(res, 400, {
        error: {
          code: 'INVALID_EVENT_ID',
          message: 'Invalid event ID.',
        },
      }, method);
    }

    const event = events.find(
      (item) => item.id === eventId
    );

    if (!event) {
      return sendJson(res, 404, {
        error: {
          code: 'EVENT_NOT_FOUND',
          message: 'Event not found.',
        },
      }, method);
    }

    const now = Date.now();

    const relatedEvents = events
      .filter(
        (item) =>
          item.id !== event.id &&
          item.category === event.category &&
          item.status === 'published' &&
          new Date(item.ends_at).getTime() > now
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime()
      )
      .slice(0, 3)
      .map(toListEvent);

    const registration = getDemoRegistration(
      req,
      event.id
    );

    const userRegistration = registration
      ? registrationPayload(registration)
      : null;

    let buttonState = 'open';
    let buttonReason = null;

    if (registration?.status === 'registered') {
      buttonState = 'registered';
    } else if (registration?.status === 'waitlisted') {
      buttonState = 'waitlisted';
    } else if (event.status === 'cancelled') {
      buttonState = 'disabled';
      buttonReason = 'Event cancelled';
    } else if (
      event.status === 'completed' ||
      new Date(event.ends_at).getTime() <= now
    ) {
      buttonState = 'disabled';
      buttonReason = 'Event ended';
    } else if (
      event.registration_deadline &&
      new Date(event.registration_deadline).getTime() <= now
    ) {
      buttonState = 'disabled';
      buttonReason = 'Registration closed';
    } else if (
      event.confirmedCount >= event.capacity
    ) {
      buttonState = 'open';
      buttonReason =
        'Event is full — join the waitlist';
    }

    return sendJson(res, 200, {
      event,
      userRegistration,
      buttonState,
      buttonReason,
      relatedEvents,
    }, method);
  }

  return sendJson(res, 404, {
    error: {
      code: 'NOT_FOUND',
      message: 'Event API route not found.',
    },
  }, method);
};