export function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CategoryPalette {
  colors: [string, string, string];
  pattern: 'dot_grid' | 'waves' | 'diagonal_stripes' | 'hexagons' | 'concentric_circles' | 'circuit_lines' | 'confetti';
}

export const CATEGORY_PALETTES: Record<string, CategoryPalette> = {
  technical: {
    colors: ['#1e3a8a', '#2563eb', '#06b6d4'],
    pattern: 'dot_grid',
  },
  cultural: {
    colors: ['#701a75', '#d946ef', '#f97316'],
    pattern: 'waves',
  },
  sports: {
    colors: ['#14532d', '#16a34a', '#84cc16'],
    pattern: 'diagonal_stripes',
  },
  workshop: {
    colors: ['#451a03', '#d97706', '#b45309'],
    pattern: 'hexagons',
  },
  seminar: {
    colors: ['#1e1b4b', '#4f46e5', '#8b5cf6'],
    pattern: 'concentric_circles',
  },
  hackathon: {
    colors: ['#09090b', '#7c3aed', '#22c55e'],
    pattern: 'circuit_lines',
  },
  social: {
    colors: ['#831843', '#ec4899', '#eab308'],
    pattern: 'confetti',
  },
};

export function buildArt(eventId: string, category: string): string {
  const seed = fnv1a(eventId);
  const rand = mulberry32(seed);

  const palette = CATEGORY_PALETTES[category.toLowerCase()] || CATEGORY_PALETTES.technical;
  const [col1, col2, col3] = palette.colors;

  const width = 640;
  const height = 360;

  // 5 to 7 blobs
  const blobCount = Math.floor(rand() * 3) + 5;
  const blobs: string[] = [];

  for (let i = 0; i < blobCount; i++) {
    const cx = Math.floor(rand() * width);
    const cy = Math.floor(rand() * height);
    // radii between 20% and 45% of height (72 to 162)
    const rx = Math.floor(rand() * (162 - 72 + 1)) + 72;
    const ry = Math.floor(rand() * (162 - 72 + 1)) + 72;
    const color = i % 2 === 0 ? col2 : col3;
    const opacity = (rand() * 0.4 + 0.3).toFixed(2);
    blobs.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${opacity}" filter="url(#blur)" />`
    );
  }

  // Category pattern
  let patternDef = '';
  let patternRect = '';

  switch (palette.pattern) {
    case 'dot_grid':
      patternDef = `
        <pattern id="pat-${eventId}" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="2" fill="${col3}" opacity="0.3" />
        </pattern>`;
      patternRect = `<rect width="${width}" height="${height}" fill="url(#pat-${eventId})" />`;
      break;

    case 'waves':
      patternDef = `
        <pattern id="pat-${eventId}" width="60" height="30" patternUnits="userSpaceOnUse">
          <path d="M 0 15 Q 15 0 30 15 T 60 15" fill="none" stroke="${col3}" stroke-width="2" opacity="0.3" />
        </pattern>`;
      patternRect = `<rect width="${width}" height="${height}" fill="url(#pat-${eventId})" />`;
      break;

    case 'diagonal_stripes':
      patternDef = `
        <pattern id="pat-${eventId}" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="20" stroke="${col3}" stroke-width="4" opacity="0.25" />
        </pattern>`;
      patternRect = `<rect width="${width}" height="${height}" fill="url(#pat-${eventId})" />`;
      break;

    case 'hexagons':
      patternDef = `
        <pattern id="pat-${eventId}" width="40" height="40" patternUnits="userSpaceOnUse">
          <polygon points="20,2 38,12 38,28 20,38 2,28 2,12" fill="none" stroke="${col2}" stroke-width="1.5" opacity="0.3" />
        </pattern>`;
      patternRect = `<rect width="${width}" height="${height}" fill="url(#pat-${eventId})" />`;
      break;

    case 'concentric_circles':
      patternDef = `
        <pattern id="pat-${eventId}" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="40" cy="40" r="10" fill="none" stroke="${col3}" stroke-width="1.5" opacity="0.35" />
          <circle cx="40" cy="40" r="25" fill="none" stroke="${col3}" stroke-width="1.5" opacity="0.25" />
          <circle cx="40" cy="40" r="38" fill="none" stroke="${col3}" stroke-width="1.5" opacity="0.15" />
        </pattern>`;
      patternRect = `<rect width="${width}" height="${height}" fill="url(#pat-${eventId})" />`;
      break;

    case 'circuit_lines':
      patternDef = `
        <pattern id="pat-${eventId}" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 0 25 L 20 25 L 30 10 L 50 10 M 20 25 L 30 40 L 50 40" fill="none" stroke="${col3}" stroke-width="1.5" opacity="0.35" />
          <circle cx="20" cy="25" r="2.5" fill="${col3}" opacity="0.6" />
          <circle cx="50" cy="10" r="2.5" fill="${col3}" opacity="0.6" />
          <circle cx="50" cy="40" r="2.5" fill="${col3}" opacity="0.6" />
        </pattern>`;
      patternRect = `<rect width="${width}" height="${height}" fill="url(#pat-${eventId})" />`;
      break;

    case 'confetti':
      const confettiPieces: string[] = [];
      for (let c = 0; c < 20; c++) {
        const x = Math.floor(rand() * width);
        const y = Math.floor(rand() * height);
        const r = Math.floor(rand() * 360);
        const col = c % 2 === 0 ? col2 : col3;
        confettiPieces.push(
          `<rect x="${x}" y="${y}" width="6" height="12" rx="2" fill="${col}" opacity="0.4" transform="rotate(${r} ${x} ${y})" />`
        );
      }
      patternRect = confettiPieces.join('');
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg-grad-${eventId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${col1}" />
      <stop offset="100%" stop-color="${col2}" />
    </linearGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="35" />
    </filter>
    ${patternDef}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg-grad-${eventId})" />
  <g>${blobs.join('')}</g>
  ${patternRect}
</svg>`;
}
