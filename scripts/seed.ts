import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as jose from 'jose';
import { Client } from 'pg';
import {
  SKILLS_TAXONOMY,
  CATEGORIES,
  DEPARTMENTS,
  suite,
  clientPrepareAndBlind,
  clientFinalizeToken,
  importPublicKeyJwk,
  exportKeyToJwk,
  PURPOSES,
} from '../packages/shared/src';


function computeJwkFingerprint(jwk: unknown): string {
  const canonical = (obj: any): string => obj === null || typeof obj !== 'object' ? JSON.stringify(obj) : Array.isArray(obj) ? '[' + obj.map(canonical).join(',') + ']' : '{' + Object.keys(obj).sort().map(k => JSON.stringify(k)+':'+canonical(obj[k])).join(',') + '}';
  return crypto.createHash('sha256').update(canonical(jwk), 'utf8').digest('hex');
}
function encryptPrivateKey(jwk: unknown, secretHex: string): Buffer {
  const key = Buffer.from(secretHex, 'hex'); const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(jwk), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function pickRandom<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickRandomSubset<T>(arr: readonly T[] | T[], minCount: number, maxCount: number): T[] {
  const count = Math.floor(rand() * (maxCount - minCount + 1)) + minCount;
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, count);
}

export async function runSeed() {
  console.log('--- Starting Idempotent EventHive Database Seed (Seed 42) ---');

  const mainUrl = process.env.DATABASE_URL_MAIN || 'postgresql://main_user:main_pass@localhost:5432/eventhive_main';
  const issuerUrl = process.env.DATABASE_URL_ISSUER || 'postgresql://issuer_user:issuer_pass@localhost:5432/eventhive_issuer';
  const collectorUrl = process.env.DATABASE_URL_COLLECTOR || 'postgresql://collector_user:collector_pass@localhost:5432/eventhive_collector';
  const keyEncryptionSecret = process.env.KEY_ENCRYPTION_SECRET || 'deb9abc6596c50282f8f98df501e0c998c4801225dded93a5ae1adbb42f226c0';

  const clientMain = new Client({ connectionString: mainUrl });
  const clientIssuer = new Client({ connectionString: issuerUrl });
  const clientCollector = new Client({ connectionString: collectorUrl });

  await clientMain.connect();
  await clientIssuer.connect();
  await clientCollector.connect();

  console.log('Clearing existing data across all three databases...');
  // Main DB
  await clientMain.query('TRUNCATE TABLE outbox, hidden_comments, feedback_actions, user_badges, certificates, notifications, squad_invite_links, squad_invites, squad_open_roles, squad_members, squads, registrations, events, venues, user_skills, skills, users, academic_calendar CASCADE');
  // Issuer DB
  await clientIssuer.query('TRUNCATE TABLE issuance_log, eligibility, event_keys CASCADE');
  // Collector DB
  await clientCollector.query('TRUNCATE TABLE event_reports, questions, pulse_buckets, spent_tokens, feedback, public_keys, events_public CASCADE');

  console.log('Seeding skills taxonomy into Main DB...');
  for (const sk of SKILLS_TAXONOMY) {
    await clientMain.query(
      `INSERT INTO skills (id, slug, label, skill_group) VALUES ($1, $2, $3, $4)`,
      [sk.id, sk.slug, sk.label, sk.skill_group]
    );
  }

  console.log('Seeding reference venues (8)...');
  const venuesData = [
    { name: 'Main Auditorium', building: 'Admin Block', capacity: 600, step_free: true, notes: 'Grand stage and AV setup' },
    { name: 'Seminar Hall A', building: 'Tech Tower', capacity: 150, step_free: true, notes: 'Acoustic treatment' },
    { name: 'Seminar Hall B', building: 'Tech Tower', capacity: 120, step_free: true, notes: 'Interactive projection' },
    { name: 'CS Lab 1', building: 'Computing Center', capacity: 60, step_free: true, notes: '60 Linux workstations' },
    { name: 'CS Lab 2', building: 'Computing Center', capacity: 60, step_free: false, notes: '2nd floor, stairs only' },
    { name: 'Innovation Hub', building: 'Student Union', capacity: 200, step_free: true, notes: 'Movable furniture, whiteboard walls' },
    { name: 'Open Air Theatre', building: 'Campus Lawn', capacity: 800, step_free: false, notes: 'Outdoor amphitheatre' },
    { name: 'Sports Ground', building: 'Athletics Complex', capacity: 1000, step_free: false, notes: 'Floodlit stadium' },
  ];

  const venueMap = new Map<string, string>();
  for (const v of venuesData) {
    const res = await clientMain.query(
      `INSERT INTO venues (name, building, capacity, step_free, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [v.name, v.building, v.capacity, v.step_free, v.notes]
    );
    venueMap.set(v.name, res.rows[0].id);
  }

  console.log('Seeding academic calendar...');
  const now = new Date();
  const d16 = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);
  const d23 = new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000);
  const d24 = new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000);
  const d35 = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);
  const d38 = new Date(now.getTime() + 38 * 24 * 60 * 60 * 1000);

  const calData = [
    { label: 'Mid-Semester Exams', kind: 'exam', start: d16, end: d23 },
    { label: 'Festival Holiday', kind: 'holiday', start: d24, end: d24 },
    { label: 'Utsav Annual Fest', kind: 'fest', start: d35, end: d38 },
  ];

  for (const c of calData) {
    await clientMain.query(
      `INSERT INTO academic_calendar (label, kind, starts_on, ends_on) VALUES ($1, $2, $3, $4)`,
      [c.label, c.kind, c.start.toISOString().split('T')[0], c.end.toISOString().split('T')[0]]
    );
  }

  console.log('Seeding user accounts (Admin, 3 Organizers, Demo Student Riya, 59 other students)...');
  const passwordHashAdmin = await bcrypt.hash('Admin@123', 12);
  const passwordHashOrg = await bcrypt.hash('Organizer@123', 12);
  const passwordHashStudent = await bcrypt.hash('Student@123', 12);

  // Admin
  await clientMain.query(
    `INSERT INTO users (name, email, password_hash, role, department, year, roll_no, bio)
     VALUES ($1, $2, $3, 'admin', 'CSE', 4, 'ADM001', 'Platform Administrator')`,
    ['System Admin', 'admin@eventhive.test', passwordHashAdmin]
  );

  // Organizers: tech, culture, sports
  const orgMap = new Map<string, string>();
  const orgProfiles = [
    { slug: 'tech', name: 'Tech Club Organizer', email: 'tech@eventhive.test', dept: 'CSE' },
    { slug: 'culture', name: 'Cultural Society', email: 'culture@eventhive.test', dept: 'MBA' },
    { slug: 'sports', name: 'Sports Council', email: 'sports@eventhive.test', dept: 'ME' },
  ];

  for (const org of orgProfiles) {
    const res = await clientMain.query(
      `INSERT INTO users (name, email, password_hash, role, department, year, roll_no, bio)
       VALUES ($1, $2, $3, 'organizer', $4, 4, $5, 'Campus Event Organizer') RETURNING id`,
      [org.name, org.email, passwordHashOrg, org.dept, `ORG-${org.slug.toUpperCase()}`]
    );
    orgMap.set(org.slug, res.rows[0].id);
  }

  // Demo student: Riya (CSE, year 2)
  const riyaRes = await clientMain.query(
    `INSERT INTO users (name, email, password_hash, role, department, year, roll_no, bio, interests, open_to_team)
     VALUES ($1, $2, $3, 'student', 'CSE', 2, '22CSE042', 'Sophomore passionate about Web3 and open source development.', $4, true)
     RETURNING id`,
    ['Riya Sharma', 'riya@eventhive.test', passwordHashStudent, ['technical', 'hackathon']]
  );
  const riyaId = riyaRes.rows[0].id;

  // Riya skills: frontend (level 2), backend (level 1)
  await clientMain.query(`INSERT INTO user_skills (user_id, skill_id, level) VALUES ($1, 1, 2), ($1, 2, 1)`, [riyaId]);

  // 59 other students
  const studentIds: string[] = [riyaId];
  for (let i = 1; i <= 59; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    const name = `Student ${num}`;
    const email = `student${num}@eventhive.test`;
    const dept = pickRandom(DEPARTMENTS);
    const year = Math.floor(rand() * 4) + 1;
    const rollNo = `22${dept}${100 + i}`;
    const openToTeam = rand() > 0.45;
    const interests = pickRandomSubset(CATEGORIES, 1, 3);

    const sRes = await clientMain.query(
      `INSERT INTO users (name, email, password_hash, role, department, year, roll_no, bio, interests, open_to_team)
       VALUES ($1, $2, $3, 'student', $4, $5, $6, 'Student eager to learn and attend events.', $7, $8)
       RETURNING id`,
      [name, email, passwordHashStudent, dept, year, rollNo, interests, openToTeam]
    );
    const sid = sRes.rows[0].id;
    studentIds.push(sid);

    // Skills: 1 to 4 skills
    const userSkills = pickRandomSubset(SKILLS_TAXONOMY, 1, 4);
    for (const sk of userSkills) {
      const level = Math.floor(rand() * 3) + 1;
      await clientMain.query(
        `INSERT INTO user_skills (user_id, skill_id, level) VALUES ($1, $2, $3)`,
        [sid, sk.id, level]
      );
    }
  }

  // Ensure at least 3 students (not in any squad) have ui-ux (id 10), 3 have ml-ai (id 4), 3 have backend (id 2)
  for (let i = 50; i <= 52; i++) {
    await clientMain.query(`INSERT INTO user_skills (user_id, skill_id, level) VALUES ($1, 10, 2) ON CONFLICT DO NOTHING`, [studentIds[i]]);
    await clientMain.query(`UPDATE users SET open_to_team = true WHERE id = $1`, [studentIds[i]]);
  }
  for (let i = 53; i <= 55; i++) {
    await clientMain.query(`INSERT INTO user_skills (user_id, skill_id, level) VALUES ($1, 4, 3) ON CONFLICT DO NOTHING`, [studentIds[i]]);
    await clientMain.query(`UPDATE users SET open_to_team = true WHERE id = $1`, [studentIds[i]]);
  }
  for (let i = 56; i <= 58; i++) {
    await clientMain.query(`INSERT INTO user_skills (user_id, skill_id, level) VALUES ($1, 2, 2) ON CONFLICT DO NOTHING`, [studentIds[i]]);
    await clientMain.query(`UPDATE users SET open_to_team = true WHERE id = $1`, [studentIds[i]]);
  }

  console.log('Seeding 28 events in total...');

  // Helper: provision keys on Issuer and metadata on Collector
  async function provisionEventCrypto(ev: any) {
    const keys = [];
    for (const purpose of PURPOSES) {
      const keyPair = await suite.generateKey({
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      });
      const pubJwk = await exportKeyToJwk(keyPair.publicKey);
      const privJwk = await exportKeyToJwk(keyPair.privateKey);
      const encPrivKey = encryptPrivateKey(privJwk, keyEncryptionSecret);
      const fingerprint = computeJwkFingerprint(pubJwk);

      await clientIssuer.query(
        `INSERT INTO event_keys (event_id, purpose, public_key_jwk, private_key_enc)
         VALUES ($1, $2, $3, $4)`,
        [ev.id, purpose, JSON.stringify(pubJwk), encPrivKey]
      );

      keys.push({ purpose, publicKeyJwk: pubJwk, fingerprint });
    }

    const feedbackWindowEnd = new Date(
      new Date(ev.ends_at).getTime() + (ev.feedback_window_days || 7) * 24 * 60 * 60 * 1000
    ).toISOString();

    await clientCollector.query(
      `INSERT INTO events_public (event_id, title, starts_at, ends_at, feedback_window_ends_at, state)
       VALUES ($1, $2, $3, $4, $5, 'open')`,
      [ev.id, ev.title, ev.starts_at, ev.ends_at, feedbackWindowEnd]
    );

    for (const k of keys) {
      await clientCollector.query(
        `INSERT INTO public_keys (event_id, purpose, public_key_jwk, fingerprint)
         VALUES ($1, $2, $3, $4)`,
        [ev.id, k.purpose, JSON.stringify(k.publicKeyJwk), k.fingerprint]
      );
    }
  }

  // 1. 12 Past completed events over last 6 months
  for (let i = 1; i <= 12; i++) {
    const daysAgo = 15 * i;
    const evStart = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    evStart.setHours(10, 0, 0, 0);
    const evEnd = new Date(evStart.getTime() + 2 * 60 * 60 * 1000);
    const category = CATEGORIES[i % CATEGORIES.length];
    const orgId = category === 'technical' || category === 'hackathon' ? orgMap.get('tech') : category === 'cultural' || category === 'social' ? orgMap.get('culture') : orgMap.get('sports');

    const res = await clientMain.query(
      `INSERT INTO events (
         organizer_id, title, description, category, starts_at, ends_at,
         venue_id, capacity, registration_deadline, status, is_paid, price_inr
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', false, 0)
       RETURNING *`,
      [
        orgId,
        `Past Event ${i}: ${category.toUpperCase()} Session`,
        `A comprehensive past session covering foundational skills in ${category}.`,
        category,
        evStart.toISOString(),
        evEnd.toISOString(),
        venueMap.get('Seminar Hall A'),
        50,
        new Date(evStart.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      ]
    );

    const ev = res.rows[0];
    await provisionEventCrypto(ev);

    // Confirmed registrations & check-ins
    const regCount = Math.floor(rand() * 20) + 25;
    for (let s = 1; s <= regCount; s++) {
      const studentId = studentIds[s];
      const isCheckedIn = s <= Math.floor(regCount * 0.8);
      const checkinDate = isCheckedIn ? new Date(evStart.getTime() + 15 * 60 * 1000).toISOString() : null;
      await clientMain.query(
        `INSERT INTO registrations (event_id, user_id, status, registered_at, checked_in_at, qr_secret)
         VALUES ($1, $2, 'confirmed', $3, $4, $5)`,
        [ev.id, studentId, new Date(evStart.getTime() - 48 * 60 * 60 * 1000).toISOString(), checkinDate, crypto.randomBytes(32)]
      );
    }
  }

  // 2. Demo Saturday: first Saturday at least 5 days away
  const daysUntilSaturday = ((6 - now.getDay() + 7) % 7);
  const addDays = daysUntilSaturday < 5 ? daysUntilSaturday + 7 : daysUntilSaturday;
  const demoSat = new Date(now.getTime() + addDays * 24 * 60 * 60 * 1000);

  const satStart10 = new Date(demoSat); satStart10.setHours(10, 0, 0, 0);
  const satEnd13 = new Date(demoSat); satEnd13.setHours(13, 0, 0, 0);
  const satStart0930 = new Date(demoSat); satStart0930.setHours(9, 30, 0, 0);
  const satEnd1230 = new Date(demoSat); satEnd1230.setHours(12, 30, 0, 0);
  const satStart11 = new Date(demoSat); satStart11.setHours(11, 0, 0, 0);
  const satEnd14 = new Date(demoSat); satEnd14.setHours(14, 0, 0, 0);

  // Event A: Web3 Basics Bootcamp
  const web3Res = await clientMain.query(
    `INSERT INTO events (
       organizer_id, title, description, category, starts_at, ends_at,
       venue_id, capacity, registration_deadline, status, is_paid, price_inr
     ) VALUES ($1, 'Web3 Basics Bootcamp', 'Hands-on smart contract bootcamp with Solidity and Web3.js.', 'technical', $2, $3, $4, 60, $5, 'published', false, 0)
     RETURNING *`,
    [orgMap.get('tech'), satStart10.toISOString(), satEnd13.toISOString(), venueMap.get('CS Lab 1'), new Date(satStart10.getTime() - 24 * 60 * 60 * 1000).toISOString()]
  );
  const web3Ev = web3Res.rows[0];
  await provisionEventCrypto(web3Ev);

  // Event B: Competitive Coding Contest
  const cccRes = await clientMain.query(
    `INSERT INTO events (
       organizer_id, title, description, category, starts_at, ends_at,
       venue_id, capacity, registration_deadline, status, is_paid, price_inr
     ) VALUES ($1, 'Competitive Coding Contest', 'Speed algorithmic problem solving challenge.', 'technical', $2, $3, $4, 60, $5, 'published', false, 0)
     RETURNING *`,
    [orgMap.get('tech'), satStart0930.toISOString(), satEnd1230.toISOString(), venueMap.get('CS Lab 2'), new Date(satStart0930.getTime() - 24 * 60 * 60 * 1000).toISOString()]
  );
  const cccEv = cccRes.rows[0];
  await provisionEventCrypto(cccEv);

  // Event C: Cloud Hands-on Day
  const cloudRes = await clientMain.query(
    `INSERT INTO events (
       organizer_id, title, description, category, starts_at, ends_at,
       venue_id, capacity, registration_deadline, status, is_paid, price_inr
     ) VALUES ($1, 'Cloud Hands-on Day', 'Deep dive into Kubernetes, Terraform, and cloud architectures.', 'technical', $2, $3, $4, 60, $5, 'published', false, 0)
     RETURNING *`,
    [orgMap.get('tech'), satStart11.toISOString(), satEnd14.toISOString(), venueMap.get('Seminar Hall B'), new Date(satStart11.getTime() - 24 * 60 * 60 * 1000).toISOString()]
  );
  const cloudEv = cloudRes.rows[0];
  await provisionEventCrypto(cloudEv);

  // Register Riya for Web3 Basics Bootcamp
  await clientMain.query(
    `INSERT INTO registrations (event_id, user_id, status, registered_at, qr_secret)
     VALUES ($1, $2, 'confirmed', now(), $3)`,
    [web3Ev.id, riyaId, crypto.randomBytes(32)]
  );

  // Register students across these three so overlapPercent on technical 10-13 is between 30 and 50
  for (let s = 1; s <= 20; s++) {
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, qr_secret)
       VALUES ($1, $2, 'confirmed', now(), $3) ON CONFLICT DO NOTHING`,
      [web3Ev.id, studentIds[s], crypto.randomBytes(32)]
    );
  }
  for (let s = 15; s <= 30; s++) {
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, qr_secret)
       VALUES ($1, $2, 'confirmed', now(), $3) ON CONFLICT DO NOTHING`,
      [cccEv.id, studentIds[s], crypto.randomBytes(32)]
    );
  }
  for (let s = 25; s <= 40; s++) {
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, qr_secret)
       VALUES ($1, $2, 'confirmed', now(), $3) ON CONFLICT DO NOTHING`,
      [cloudEv.id, studentIds[s], crypto.randomBytes(32)]
    );
  }

  // 3. CodeStorm 24h Hackathon (hackathon, team event, 3 squads)
  const hackStart = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const hackEnd = new Date(hackStart.getTime() + 24 * 60 * 60 * 1000);

  const hackRes = await clientMain.query(
    `INSERT INTO events (
       organizer_id, title, description, category, starts_at, ends_at,
       venue_id, capacity, registration_deadline, status, is_paid, price_inr,
       is_team_event, team_min, team_max
     ) VALUES ($1, 'CodeStorm 24h Hackathon', 'Annual campus hackathon to build prototype solutions in 24 hours.', 'hackathon', $2, $3, $4, 60, $5, 'published', false, 0, true, 2, 4)
     RETURNING *`,
    [orgMap.get('tech'), hackStart.toISOString(), hackEnd.toISOString(), venueMap.get('Innovation Hub'), new Date(hackStart.getTime() - 24 * 60 * 60 * 1000).toISOString()]
  );
  const hackEv = hackRes.rows[0];
  await provisionEventCrypto(hackEv);

  // Register Riya + 11 other students (12 confirmed registrants)
  await clientMain.query(`INSERT INTO registrations (event_id, user_id, status, registered_at, qr_secret) VALUES ($1, $2, 'confirmed', now(), $3)`, [hackEv.id, riyaId, crypto.randomBytes(32)]);
  for (let s = 1; s <= 11; s++) {
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, qr_secret) VALUES ($1, $2, 'confirmed', now(), $3)`,
      [hackEv.id, studentIds[s], crypto.randomBytes(32)]
    );
  }

  // 3 Squads for CodeStorm:
  // Squad 1: full (4 members: student01..04) and locked
  const sq1Res = await clientMain.query(
    `INSERT INTO squads (event_id, name, tagline, leader_id, max_size, status)
     VALUES ($1, 'Bug Busters', 'Ready to ship', $2, 4, 'locked') RETURNING id`,
    [hackEv.id, studentIds[1]]
  );
  for (let s = 1; s <= 4; s++) {
    await clientMain.query(`INSERT INTO squad_members (squad_id, event_id, user_id) VALUES ($1, $2, $3)`, [sq1Res.rows[0].id, hackEv.id, studentIds[s]]);
  }

  // Squad 2: 2 members (student05, student06), needing ui-ux
  const sq2Res = await clientMain.query(
    `INSERT INTO squads (event_id, name, tagline, leader_id, max_size, status)
     VALUES ($1, 'Pixel Pioneers', 'Seeking UI designer', $2, 4, 'forming') RETURNING id`,
    [hackEv.id, studentIds[5]]
  );
  await clientMain.query(`INSERT INTO squad_members (squad_id, event_id, user_id) VALUES ($1, $2, $3), ($1, $2, $4)`, [sq2Res.rows[0].id, hackEv.id, studentIds[5], studentIds[6]]);
  await clientMain.query(`INSERT INTO squad_open_roles (squad_id, skill_id, count) VALUES ($1, 10, 1)`, [sq2Res.rows[0].id]); // 10 is ui-ux

  // Squad 3: 3 members (student07, student08, student09), needing ml-ai
  const sq3Res = await clientMain.query(
    `INSERT INTO squads (event_id, name, tagline, leader_id, max_size, status)
     VALUES ($1, 'Neural Knights', 'Looking for ML wizard', $2, 4, 'forming') RETURNING id`,
    [hackEv.id, studentIds[7]]
  );
  await clientMain.query(`INSERT INTO squad_members (squad_id, event_id, user_id) VALUES ($1, $2, $3), ($1, $2, $4), ($1, $2, $5)`, [sq3Res.rows[0].id, hackEv.id, studentIds[7], studentIds[8], studentIds[9]]);
  await clientMain.query(`INSERT INTO squad_open_roles (squad_id, skill_id, count) VALUES ($1, 4, 1)`, [sq3Res.rows[0].id]); // 4 is ml-ai

  // 4. Full House Mixer: category social, capacity 30, 30 confirmed, 3 waitlisted
  const mixerRes = await clientMain.query(
    `INSERT INTO events (
       organizer_id, title, description, category, starts_at, ends_at,
       venue_id, capacity, registration_deadline, status, is_paid, price_inr
     ) VALUES ($1, 'Full House Mixer', 'Social campus gathering with games, refreshments, and networking.', 'social', $2, $3, $4, 30, $5, 'published', false, 0)
     RETURNING *`,
    [orgMap.get('culture'), satStart11.toISOString(), satEnd13.toISOString(), venueMap.get('Open Air Theatre'), new Date(satStart11.getTime() - 24 * 60 * 60 * 1000).toISOString()]
  );
  const mixerEv = mixerRes.rows[0];
  await provisionEventCrypto(mixerEv);

  for (let s = 1; s <= 30; s++) {
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, qr_secret) VALUES ($1, $2, 'confirmed', now(), $3)`,
      [mixerEv.id, studentIds[s], crypto.randomBytes(32)]
    );
  }
  for (let s = 31; s <= 33; s++) {
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, qr_secret) VALUES ($1, $2, 'waitlisted', now(), $3)`,
      [mixerEv.id, studentIds[s], crypto.randomBytes(32)]
    );
  }

  // 5. Intro to Docker Workshop (live now): started 30 min ago, ends in 90 min, 20 confirmed, 8 checked in including Riya
  const dockerStart = new Date(now.getTime() - 30 * 60 * 1000);
  const dockerEnd = new Date(now.getTime() + 90 * 60 * 1000);

  const dockerRes = await clientMain.query(
    `INSERT INTO events (
       organizer_id, title, description, category, starts_at, ends_at,
       venue_id, capacity, registration_deadline, status, is_paid, price_inr
     ) VALUES ($1, 'Intro to Docker Workshop', 'Container fundamentals, building Dockerfiles and multi-stage builds.', 'workshop', $2, $3, $4, 30, $5, 'published', false, 0)
     RETURNING *`,
    [orgMap.get('tech'), dockerStart.toISOString(), dockerEnd.toISOString(), venueMap.get('CS Lab 1'), dockerStart.toISOString()]
  );
  const dockerEv = dockerRes.rows[0];
  await provisionEventCrypto(dockerEv);

  // 20 confirmed, 8 checked in including Riya
  await clientMain.query(
    `INSERT INTO registrations (event_id, user_id, status, registered_at, checked_in_at, qr_secret)
     VALUES ($1, $2, 'confirmed', now(), now(), $3)`,
    [dockerEv.id, riyaId, crypto.randomBytes(32)]
  );
  // Add eligibility for Riya in issuer for live pulse
  await clientIssuer.query(
    `INSERT INTO eligibility (event_id, user_id, purpose, window_start, window_end, max_tokens)
     VALUES ($1, $2, 'pulse', $3, $4, 30)`,
    [dockerEv.id, riyaId, dockerStart.toISOString(), dockerEnd.toISOString()]
  );

  for (let s = 1; s <= 19; s++) {
    const isCheck = s <= 7;
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, checked_in_at, qr_secret)
       VALUES ($1, $2, 'confirmed', now(), $3, $4)`,
      [dockerEv.id, studentIds[s], isCheck ? now.toISOString() : null, crypto.randomBytes(32)]
    );
    if (isCheck) {
      await clientIssuer.query(
        `INSERT INTO eligibility (event_id, user_id, purpose, window_start, window_end, max_tokens)
         VALUES ($1, $2, 'pulse', $3, $4, 30)`,
        [dockerEv.id, studentIds[s], dockerStart.toISOString(), dockerEnd.toISOString()]
      );
    }
  }

  // 6. Poster Design Workshop (feedback open): ended 1 hour ago, 12 confirmed, 8 checked in including Riya
  const posterStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const posterEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  const posterRes = await clientMain.query(
    `INSERT INTO events (
       organizer_id, title, description, category, starts_at, ends_at,
       venue_id, capacity, registration_deadline, status, is_paid, price_inr, require_feedback_for_certificate
     ) VALUES ($1, 'Poster Design Workshop', 'Visual communication principles for creative posters.', 'workshop', $2, $3, $4, 25, $5, 'completed', false, 0, true)
     RETURNING *`,
    [orgMap.get('culture'), posterStart.toISOString(), posterEnd.toISOString(), venueMap.get('Innovation Hub'), posterStart.toISOString()]
  );
  const posterEv = posterRes.rows[0];
  await provisionEventCrypto(posterEv);

  // 8 checked in including Riya
  await clientMain.query(
    `INSERT INTO registrations (event_id, user_id, status, registered_at, checked_in_at, qr_secret)
     VALUES ($1, $2, 'confirmed', now(), now(), $3)`,
    [posterEv.id, riyaId, crypto.randomBytes(32)]
  );
  await clientIssuer.query(
    `INSERT INTO eligibility (event_id, user_id, purpose, window_start, window_end, max_tokens)
     VALUES ($1, $2, 'feedback', $3, $4, 1)`,
    [posterEv.id, riyaId, posterEnd.toISOString(), new Date(posterEnd.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()]
  );

  for (let s = 1; s <= 11; s++) {
    const isCheck = s <= 7;
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, checked_in_at, qr_secret)
       VALUES ($1, $2, 'confirmed', now(), $3, $4)`,
      [posterEv.id, studentIds[s], isCheck ? now.toISOString() : null, crypto.randomBytes(32)]
    );
    if (isCheck) {
      await clientIssuer.query(
        `INSERT INTO eligibility (event_id, user_id, purpose, window_start, window_end, max_tokens)
         VALUES ($1, $2, 'feedback', $3, $4, 1)`,
        [posterEv.id, studentIds[s], posterEnd.toISOString(), new Date(posterEnd.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()]
      );
    }
  }

  // 7. Open Mic Night (sealed report): cultural event with 14 checked-in students, 10 submitted feedback via real flow
  const micStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const micEnd = new Date(now.getTime() - 45 * 60 * 60 * 1000);

  const micRes = await clientMain.query(
    `INSERT INTO events (
       organizer_id, title, description, category, starts_at, ends_at,
       venue_id, capacity, registration_deadline, status, is_paid, price_inr
     ) VALUES ($1, 'Open Mic Night', 'Poetry, acoustic music, and stand-up comedy performances.', 'cultural', $2, $3, $4, 40, $5, 'completed', false, 0)
     RETURNING *`,
    [orgMap.get('culture'), micStart.toISOString(), micEnd.toISOString(), venueMap.get('Main Auditorium'), micStart.toISOString()]
  );
  const micEv = micRes.rows[0];
  await provisionEventCrypto(micEv);

  // 14 checked in
  for (let s = 1; s <= 14; s++) {
    await clientMain.query(
      `INSERT INTO registrations (event_id, user_id, status, registered_at, checked_in_at, qr_secret)
       VALUES ($1, $2, 'confirmed', now(), now(), $3)`,
      [micEv.id, studentIds[s], crypto.randomBytes(32)]
    );
    await clientIssuer.query(
      `INSERT INTO eligibility (event_id, user_id, purpose, window_start, window_end, max_tokens)
       VALUES ($1, $2, 'feedback', $3, $4, 1)`,
      [micEv.id, studentIds[s], micEnd.toISOString(), new Date(micEnd.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );
  }

  // 10 students submit feedback through real blind signature flow
  const micKeyRes = await clientCollector.query(`SELECT public_key_jwk FROM public_keys WHERE event_id = $1 AND purpose = 'feedback'`, [micEv.id]);
  const micPubJwk = micKeyRes.rows[0].public_key_jwk;
  const micPubKey = await importPublicKeyJwk(micPubJwk);

  const micPrivKeyRes = await clientIssuer.query(`SELECT private_key_enc FROM event_keys WHERE event_id = $1 AND purpose = 'feedback'`, [micEv.id]);
  const micPrivKeyJwk = JSON.parse(require('crypto').createDecipheriv('aes-256-gcm', Buffer.from(keyEncryptionSecret, 'hex'), micPrivKeyRes.rows[0].private_key_enc.subarray(0, 12)).setAuthTag(micPrivKeyRes.rows[0].private_key_enc.subarray(12, 28)).update(micPrivKeyRes.rows[0].private_key_enc.subarray(28)).toString('utf8'));
  const micPrivKey = await crypto.webcrypto.subtle.importKey('jwk', micPrivKeyJwk, { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['sign']);

  for (let s = 1; s <= 10; s++) {
    const { prepared, blindedMsg, inv } = await clientPrepareAndBlind(micPubKey, 'feedback', micEv.id);
    const blindSig = await suite.blindSign(micPrivKey, blindedMsg);
    const token = await clientFinalizeToken(micPubKey, prepared, blindSig, inv);
    const tokenHash = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(token.p, 'base64url'), Buffer.from(token.s, 'base64url')])).digest('hex');

    await clientCollector.query(
      `INSERT INTO feedback (event_id, token_hash, overall, content, delivery, venue, value, topic, would_recommend, comment)
       VALUES ($1, $2, 5, 5, 4, 4, 5, 'Speaker', true, $3)`,
      [micEv.id, tokenHash, `Wonderful energy and community atmosphere at event ${s}!`]
    );
    await clientIssuer.query(`UPDATE eligibility SET issued_count = 1 WHERE event_id = $1 AND user_id = $2 AND purpose = 'feedback'`, [micEv.id, studentIds[s]]);
  }

  // Close feedback, set cooldown over, release report
  await clientCollector.query(
    `UPDATE events_public
     SET state = 'closed', closed_at = $1, cooldown_until = $2
     WHERE event_id = $3`,
    [micEnd.toISOString(), new Date(micEnd.getTime() + 20 * 1000).toISOString(), micEv.id]
  );

  // Sealed report
  const sampleReport = {
    responseCount: 10,
    average: { overall: 4.8, content: 4.7, delivery: 4.5, venue: 4.6, value: 4.9 },
    recommend: 100,
    positiveSplit: { positive: 10, negative: 0 },
    topics: { Speaker: 10 },
    comments: [
      { id: crypto.randomUUID(), text: 'Incredible acoustic music and great audience support.' },
      { id: crypto.randomUUID(), text: 'Loved the stand-up comedy segment!' },
    ],
    pulseTimeline: [],
  };

  await clientCollector.query(
    `INSERT INTO event_reports (event_id, version, report, released_at)
     VALUES ($1, 1, $2, now()) ON CONFLICT DO NOTHING`,
    [micEv.id, JSON.stringify(sampleReport)]
  );
  await clientCollector.query(`UPDATE events_public SET sealed = true WHERE event_id = $1`, [micEv.id]);

  // Seed 3 feedback actions on Open Mic Night, 2 public
  await clientMain.query(
    `INSERT INTO feedback_actions (event_id, title, owner_role, due_date, status, is_public) VALUES
     ($1, 'Upgrade stage monitors and mic stands', 'Logistics Lead', '2026-11-20', 'in_progress', true),
     ($1, 'Extend performance slots to 10 minutes', 'Cultural Coordinator', '2026-11-25', 'done', true),
     ($1, 'Review soundboard operator training', 'Tech Lead', '2026-11-30', 'planned', false)`,
    [micEv.id]
  );

  // 8. Remaining upcoming events (total reaches 28)
  const remainingCategories = ['sports', 'workshop', 'seminar', 'social', 'technical', 'cultural', 'sports', 'seminar', 'workshop'];
  for (let i = 0; i < remainingCategories.length; i++) {
    const cat = remainingCategories[i];
    const dayOffset = 5 + i * 2;
    const start = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    start.setHours(14, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const isPaid = i % 2 === 1;
    const price = isPaid ? 499 : 0;
    const orgId = cat === 'technical' ? orgMap.get('tech') : cat === 'cultural' || cat === 'social' ? orgMap.get('culture') : orgMap.get('sports');

    const res = await clientMain.query(
      `INSERT INTO events (
         organizer_id, title, description, category, starts_at, ends_at,
         venue_id, capacity, registration_deadline, status, is_paid, price_inr,
         accessibility, dietary, tags
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 50, $8, 'published', $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        orgId,
        `Campus ${cat.toUpperCase()} Gathering #${i + 1}`,
        `Join us for an exciting campus event exploring interactive activities in ${cat}.`,
        cat,
        start.toISOString(),
        end.toISOString(),
        venueMap.get('Main Auditorium'),
        new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        isPaid,
        price,
        ['step_free', 'seating_available'],
        ['veg'],
        [cat, 'campus', '2026'],
      ]
    );

    const ev = res.rows[0];
    await provisionEventCrypto(ev);
  }

  // Print Best-Slot Finder analysis verification on Demo Saturday
  console.log('\n--- Checking Best-Slot Finder Analysis on Demo Saturday ---');
  const checkRes = await clientMain.query(
    `SELECT e.id, e.title, e.category
     FROM events e
     WHERE e.status IN ('pending', 'published')
       AND e.category = 'technical'
       AND e.starts_at < $1 AND e.ends_at > $2`,
    [satEnd13.toISOString(), satStart10.toISOString()]
  );
  console.log(`Demo Saturday Technical Overlapping Events Count: ${checkRes.rowCount}`);

  await clientMain.end();
  await clientIssuer.end();
  await clientCollector.end();

  console.log('--- Seed Completed Successfully! ---');
}

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('Seed script error:', err);
    process.exit(1);
  });
}
