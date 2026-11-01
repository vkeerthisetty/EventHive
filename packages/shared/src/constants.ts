export const APP_NAME = 'EventHive';
export const APP_TAGLINE = 'Every event on campus, from discovery to feedback.';

export const ROLES = ['student', 'organizer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const CATEGORIES = [
  'technical',
  'cultural',
  'sports',
  'workshop',
  'seminar',
  'hackathon',
  'social',
] as const;
export type EventCategory = (typeof CATEGORIES)[number];

export const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'MBA'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const EVENT_STATUSES = [
  'draft',
  'pending',
  'published',
  'cancelled',
  'completed',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const SKILL_GROUPS = ['tech', 'creative', 'business', 'sports'] as const;
export type SkillGroup = (typeof SKILL_GROUPS)[number];

export interface SkillItem {
  id: number;
  slug: string;
  label: string;
  skill_group: SkillGroup;
}

export const SKILLS_TAXONOMY: SkillItem[] = [
  // Tech
  { id: 1, slug: 'frontend', label: 'Frontend', skill_group: 'tech' },
  { id: 2, slug: 'backend', label: 'Backend', skill_group: 'tech' },
  { id: 3, slug: 'mobile', label: 'Mobile', skill_group: 'tech' },
  { id: 4, slug: 'ml-ai', label: 'ML / AI', skill_group: 'tech' },
  { id: 5, slug: 'data', label: 'Data', skill_group: 'tech' },
  { id: 6, slug: 'devops', label: 'DevOps', skill_group: 'tech' },
  { id: 7, slug: 'iot', label: 'IoT / Hardware', skill_group: 'tech' },
  { id: 8, slug: 'security', label: 'Security', skill_group: 'tech' },
  { id: 9, slug: 'game-dev', label: 'Game Dev', skill_group: 'tech' },
  // Creative
  { id: 10, slug: 'ui-ux', label: 'UI/UX Design', skill_group: 'creative' },
  { id: 11, slug: 'graphic-design', label: 'Graphic Design', skill_group: 'creative' },
  { id: 12, slug: 'video', label: 'Video Editing', skill_group: 'creative' },
  { id: 13, slug: 'writing', label: 'Content Writing', skill_group: 'creative' },
  // Business
  { id: 14, slug: 'pitching', label: 'Pitching', skill_group: 'business' },
  { id: 15, slug: 'product', label: 'Product Management', skill_group: 'business' },
  { id: 16, slug: 'marketing', label: 'Marketing', skill_group: 'business' },
  // Sports
  { id: 17, slug: 'captain', label: 'Captain', skill_group: 'sports' },
  { id: 18, slug: 'goalkeeper', label: 'Goalkeeper', skill_group: 'sports' },
  { id: 19, slug: 'defender', label: 'Defender', skill_group: 'sports' },
  { id: 20, slug: 'midfielder', label: 'Midfielder', skill_group: 'sports' },
  { id: 21, slug: 'forward', label: 'Forward', skill_group: 'sports' },
  { id: 22, slug: 'bowler', label: 'Bowler', skill_group: 'sports' },
  { id: 23, slug: 'batter', label: 'Batter', skill_group: 'sports' },
  { id: 24, slug: 'fielder', label: 'Fielder', skill_group: 'sports' },
  { id: 25, slug: 'setter', label: 'Setter', skill_group: 'sports' },
  { id: 26, slug: 'spiker', label: 'Spiker', skill_group: 'sports' },
];

export const ACCESSIBILITY_OPTIONS = [
  'step_free',
  'accessible_restroom',
  'seating_available',
  'sign_language',
  'captioning',
  'low_sensory',
  'quiet_room',
] as const;
export type AccessibilityOption = (typeof ACCESSIBILITY_OPTIONS)[number];

export const DIETARY_OPTIONS = [
  'veg',
  'vegan',
  'jain',
  'halal',
  'gluten_free',
  'contains_nuts',
] as const;
export type DietaryOption = (typeof DIETARY_OPTIONS)[number];

export const FEEDBACK_TOPICS = [
  'Content',
  'Speaker',
  'Organisation',
  'Venue',
  'Timing',
  'Food',
  'Registration process',
  'Nothing, it was great',
] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

export const PULSE_MOODS = ['loving', 'confusing', 'lost', 'too_slow'] as const;
export type PulseMood = (typeof PULSE_MOODS)[number];

export const PURPOSES = ['feedback', 'pulse', 'question', 'qvote'] as const;
export type Purpose = (typeof PURPOSES)[number];

export const BADGES = [
  { slug: 'first_step', name: 'First Step', description: '1 check-in' },
  { slug: 'regular', name: 'Regular', description: '10 check-ins' },
  { slug: 'explorer', name: 'Explorer', description: 'Check-ins in at least 5 different categories' },
  { slug: 'night_owl', name: 'Night Owl', description: 'At least 3 check-ins at events starting at or after 18:00' },
  { slug: 'streak_3', name: 'On a Roll', description: 'Check-ins in 3 consecutive ISO weeks' },
  { slug: 'team_player', name: 'Team Player', description: 'Checked in to an event with a locked squad' },
  { slug: 'hackathon_hero', name: 'Hackathon Hero', description: 'Check-ins at 2 or more hackathons' },
] as const;
