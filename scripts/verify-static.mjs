import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const ok = (condition, message) => { if (!condition) failures.push(message); };
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const app = read('apps/web/src/App.tsx');
const allowedPages = [
  "./pages/Home", "./pages/EventListing", "./pages/EventDetail", "./pages/Login",
  "./pages/Signup", "./pages/Privacy", "./pages/MyEvents", "./pages/Profile",
  "./pages/StudentFeedback", "./pages/OrganizerDashboard"
];
for (const page of allowedPages) ok(app.includes(page), `Missing scoped page import: ${page}`);
for (const forbidden of ['SquadFinder','CampusPassport','DepartmentCup','LivePulse','BestSlot','CertificateVerify','CampusWrapped']) {
  ok(!app.includes(forbidden), `Out-of-scope route still present: ${forbidden}`);
}

const login = read('apps/web/src/pages/Login.tsx');
ok(login.includes('riya@eventhive.test') && login.includes('Student@123'), 'Student demo login does not match seed');
ok(login.includes('tech@eventhive.test') && login.includes('Organizer@123'), 'Organizer demo login does not match seed');
ok(login.includes('admin@eventhive.test') && login.includes('Admin@123'), 'Admin demo login does not match seed');

const signup = read('apps/web/src/pages/Signup.tsx');
for (const dept of ['CSE','ECE','EEE','ME','CE','MBA']) ok(signup.includes(`'${dept}'`) || signup.includes(`\"${dept}\"`), `Signup missing valid department ${dept}`);
ok(signup.includes('organizerCode'), 'Organizer signup code UI is missing');

const server = read('apps/api/src/server.ts');
for (const mount of ["'/api/auth'", "'/api/events'", "'/api/registrations'", "'/api/me'", "'/api/anon'", "'/api/organizer'"]) {
  ok(server.includes(mount), `Missing API mount ${mount}`);
}
for (const forbidden of ['slotsRouter','squadsRouter','certificatesRouter','adminRouter','engagementRouter']) {
  ok(!server.includes(forbidden), `Out-of-scope API router still mounted: ${forbidden}`);
}

const reg = read('apps/api/src/routes/registrations.ts');
for (const required of ["post('/:id/register'", "post('/:id/cancel'", "get('/:id/qr-secret'", "get('/clashes'", "get('/events'", "get('/notifications'"]) {
  ok(reg.includes(required), `Missing registration/My Events route: ${required}`);
}

const anon = read('apps/api/src/routes/anon.ts');
ok(anon.includes("post('/grant'"), 'Anonymous feedback grant endpoint missing');
ok(anon.includes("purpose !== 'feedback'"), 'Anonymous grant is not scoped to feedback');

const sharedIndex = read('packages/shared/src/index.ts');
ok(!sharedIndex.includes("./living-qr"), 'Browser shared entrypoint exports Node-only living QR verifier');
const tokens = read('packages/shared/src/tokens.ts');
ok(!/from ['\"](?:node:)?crypto['\"]/.test(tokens), 'Browser token helper imports Node crypto');
ok(!tokens.includes('Buffer.'), 'Browser token helper uses Buffer');

const vercel = JSON.parse(read('vercel.json'));
ok(vercel.outputDirectory === 'apps/web/dist', 'Vercel outputDirectory must be apps/web/dist');
ok(fs.existsSync(path.join(root, 'api/[...path].js')), 'Vercel API proxy is missing');

// Resolve all local relative imports in TS/TSX source files.
const roots = ['apps', 'packages', 'scripts'];
const files = [];
for (const r of roots) {
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules','dist'].includes(ent.name)) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(ent.name)) files.push(p);
    }
  };
  walk(path.join(root, r));
}
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:from\s+|import\s*)['\"](\.[^'\"]+)['\"]/g)) {
    const base = path.resolve(path.dirname(file), m[1]);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
    ok(candidates.some(fs.existsSync), `Broken local import ${m[1]} in ${path.relative(root, file)}`);
  }
}

if (failures.length) {
  console.error('Static verification FAILED:');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('Static verification passed: scoped routes, demo credentials, browser-safe crypto boundary, Vercel config, and local imports.');
