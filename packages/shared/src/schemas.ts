import { z } from 'zod';
import {
  CATEGORIES,
  DEPARTMENTS,
  EVENT_STATUSES,
  FEEDBACK_TOPICS,
  PULSE_MOODS,
  PURPOSES,
  ROLES,
  ACCESSIBILITY_OPTIONS,
  DIETARY_OPTIONS,
} from './constants';

export const SignupStudentSchema = z.strictObject({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  department: z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'Invalid department' }) }),
  year: z.number().int().min(1).max(5),
  roll_no: z.string().optional().nullable(),
});

export const SignupOrganizerSchema = z.strictObject({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  department: z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'Invalid department' }) }),
  year: z.number().int().min(1).max(5),
  organizerCode: z.string().min(1, 'Organizer code is required'),
});

export const LoginSchema = z.strictObject({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const ProfileUpdateSchema = z.strictObject({
  bio: z.string().max(280, 'Bio cannot exceed 280 characters').optional().nullable(),
  open_to_team: z.boolean().optional(),
  interests: z.array(z.enum(CATEGORIES)).optional(),
  skills: z
    .array(
      z.strictObject({
        skill_id: z.number().int(),
        level: z.number().int().min(1).max(3),
      })
    )
    .optional(),
});

export const CreateEventSchema = z
  .strictObject({
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(5000),
    category: z.enum(CATEGORIES),
    startsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
    endsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
    venueId: z.string().uuid(),
    capacity: z.number().int().min(1),
    registrationDeadline: z.string().datetime({ offset: true }).or(z.string().min(10)),
    bannerUrl: z.string().url().nullable().optional(),
    isPaid: z.boolean().default(false),
    priceInr: z.number().int().min(0).default(0),
    status: z.enum(EVENT_STATUSES).default('draft'),
    targetDepartments: z.array(z.string()).default([]),
    targetYears: z.array(z.number().int()).default([]),
    isTeamEvent: z.boolean().default(false),
    teamMin: z.number().int().min(1).max(10).nullable().optional(),
    teamMax: z.number().int().min(1).max(10).nullable().optional(),
    accessibility: z.array(z.string()).default([]),
    dietary: z.array(z.string()).default([]),
    tags: z.array(z.string()).max(8).default([]),
    requireFeedbackForCertificate: z.boolean().default(true),
    feedbackWindowDays: z.number().int().min(1).default(7),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .refine((data) => new Date(data.registrationDeadline) <= new Date(data.startsAt), {
    message: 'registrationDeadline cannot be after startsAt',
    path: ['registrationDeadline'],
  })
  .refine(
    (data) => {
      if (!data.isTeamEvent) return true;
      if (data.teamMin == null || data.teamMax == null) return false;
      return data.teamMin <= data.teamMax;
    },
    {
      message: 'teamMin must be <= teamMax for team events',
      path: ['teamMin'],
    }
  );

export const UpdateEventSchema = z.strictObject({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(5000).optional(),
  category: z.enum(CATEGORIES).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  venueId: z.string().uuid().optional(),
  capacity: z.number().int().min(1).optional(),
  registrationDeadline: z.string().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  isPaid: z.boolean().optional(),
  priceInr: z.number().int().min(0).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  targetDepartments: z.array(z.string()).optional(),
  targetYears: z.array(z.number().int()).optional(),
  isTeamEvent: z.boolean().optional(),
  teamMin: z.number().int().min(1).max(10).nullable().optional(),
  teamMax: z.number().int().min(1).max(10).nullable().optional(),
  accessibility: z.array(z.string()).optional(),
  dietary: z.array(z.string()).optional(),
  tags: z.array(z.string()).max(8).optional(),
  requireFeedbackForCertificate: z.boolean().optional(),
  feedbackWindowDays: z.number().int().min(1).optional(),
});

export const SlotAnalysisSchema = z.strictObject({
  category: z.enum(CATEGORIES),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  venueId: z.string().uuid().nullable().optional(),
  targetDepartments: z.array(z.string()).optional().default([]),
  targetYears: z.array(z.number().int()).optional().default([]),
  excludeEventId: z.string().uuid().nullable().optional(),
});

export const CreateSquadSchema = z.strictObject({
  name: z.string().min(3).max(40),
  tagline: z.string().max(140).optional().nullable(),
  maxSize: z.number().int().min(1).max(10),
  openRoles: z
    .array(
      z.strictObject({
        skillId: z.number().int(),
        count: z.number().int().min(1).max(5),
      })
    )
    .default([]),
});

export const UpdateSquadSchema = z.strictObject({
  name: z.string().min(3).max(40).optional(),
  tagline: z.string().max(140).optional().nullable(),
  openRoles: z
    .array(
      z.strictObject({
        skillId: z.number().int(),
        count: z.number().int().min(1).max(5),
      })
    )
    .optional(),
});

export const SquadInviteCandidateSchema = z.strictObject({
  userId: z.string().uuid(),
});

export const CheckinPayloadSchema = z.strictObject({
  payload: z.string().min(1),
});

export const AnonGrantRequestSchema = z.strictObject({
  eventId: z.string().uuid(),
  purpose: z.enum(PURPOSES),
});

export const IssuerIssueSchema = z.strictObject({
  grant: z.string().min(1),
  blindedMsgs: z.array(z.string().min(1)).min(1),
});

export const TokenObjectSchema = z.strictObject({
  p: z.string().min(1),
  s: z.string().min(1),
});

export const CollectorFeedbackSchema = z.strictObject({
  eventId: z.string().uuid(),
  token: TokenObjectSchema,
  overall: z.number().int().min(1).max(5),
  content: z.number().int().min(1).max(5),
  delivery: z.number().int().min(1).max(5),
  venue: z.number().int().min(1).max(5),
  value: z.number().int().min(1).max(5),
  topic: z.enum(FEEDBACK_TOPICS),
  wouldRecommend: z.boolean(),
  comment: z.string().max(500).nullable().optional(),
});

export const CollectorPulseSchema = z.strictObject({
  eventId: z.string().uuid(),
  token: TokenObjectSchema,
  mood: z.enum(PULSE_MOODS),
});

export const CollectorQuestionSchema = z.strictObject({
  eventId: z.string().uuid(),
  token: TokenObjectSchema,
  body: z.string().min(1).max(200),
});

export const CollectorVoteSchema = z.strictObject({
  token: TokenObjectSchema,
});

export const FeedbackActionSchema = z.strictObject({
  title: z.string().min(1),
  ownerRole: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.enum(['planned', 'in_progress', 'done']),
  isPublic: z.boolean().default(false),
});

export const AdminUserRoleSchema = z.strictObject({
  role: z.enum(ROLES),
});

export const AdminVenueSchema = z.strictObject({
  name: z.string().min(1),
  building: z.string().min(1),
  capacity: z.number().int().min(1),
  step_free: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const AdminCalendarSchema = z
  .strictObject({
    label: z.string().min(1),
    kind: z.enum(['exam', 'holiday', 'break', 'fest']),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((data) => new Date(data.endsOn) >= new Date(data.startsOn), {
    message: 'endsOn must not be before startsOn',
    path: ['endsOn'],
  });
