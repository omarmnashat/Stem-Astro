/**
 * Space-science formulas for the ExoLife calculator.
 * Constants are rounded textbook values (good for learning, not for navigation).
 */
export const G = 6.674e-11; // m³ kg⁻¹ s⁻²
export const C = 299792458; // m/s
export const G0 = 9.80665; // m/s²

export const BODIES = {
  earth: { name: 'Earth', mass: 5.972e24, radius: 6.371e6, irradiance: 1361 },
  moon: { name: 'The Moon', mass: 7.342e22, radius: 1.7374e6, irradiance: 1361 },
  mars: { name: 'Mars', mass: 6.417e23, radius: 3.3895e6, irradiance: 590 },
};

const surfaceG = (b) => (G * b.mass) / (b.radius * b.radius);

const bodyField = { key: 'body', label: 'Planet / body', type: 'body' };

export const FORMULAS = [
  {
    id: 'weight',
    icon: '⚖️',
    title: 'Your weight on another world',
    formula: 'W = m × g',
    explain: 'Mass stays the same everywhere, but weight depends on gravity (g).',
    fields: [
      { key: 'mass', label: 'Your mass', unit: 'kg', def: 40 },
      bodyField,
    ],
    compute: (v) => {
      const g = surfaceG(BODIES[v.body]);
      const w = v.mass * g;
      return [
        { label: `Gravity on ${BODIES[v.body].name}`, value: g, unit: 'm/s²' },
        { label: 'Weight', value: w, unit: 'N' },
        { label: 'Feels like (on Earth)', value: w / G0, unit: 'kg' },
      ];
    },
  },
  {
    id: 'gravity-alt',
    icon: '🛰️',
    title: 'Gravity at a height',
    formula: 'g = G·M / (R + h)²',
    explain: 'Gravity gets weaker the farther you are from the centre of a planet.',
    fields: [bodyField, { key: 'alt', label: 'Height above ground', unit: 'km', def: 400 }],
    compute: (v) => {
      const b = BODIES[v.body];
      const g = (G * b.mass) / Math.pow(b.radius + v.alt * 1000, 2);
      return [
        { label: 'Gravity at that height', value: g, unit: 'm/s²' },
        { label: 'Compared with the surface', value: (g / surfaceG(b)) * 100, unit: '%' },
      ];
    },
  },
  {
    id: 'escape',
    icon: '🚀',
    title: 'Escape velocity',
    formula: 'v = √(2·G·M / R)',
    explain: 'The speed a rocket needs to leave a planet and never fall back.',
    fields: [bodyField],
    compute: (v) => {
      const b = BODIES[v.body];
      const ve = Math.sqrt((2 * G * b.mass) / b.radius);
      return [
        { label: 'Escape velocity', value: ve, unit: 'm/s' },
        { label: 'In km/s', value: ve / 1000, unit: 'km/s' },
        { label: 'In km/h', value: ve * 3.6, unit: 'km/h' },
      ];
    },
  },
  {
    id: 'orbit',
    icon: '🌍',
    title: 'Orbit speed & time',
    formula: 'v = √(G·M / r),  T = 2π·r / v',
    explain: 'How fast a satellite must fly to circle a planet, and how long one lap takes.',
    fields: [bodyField, { key: 'alt', label: 'Orbit height', unit: 'km', def: 400 }],
    compute: (v) => {
      const b = BODIES[v.body];
      const r = b.radius + v.alt * 1000;
      const speed = Math.sqrt((G * b.mass) / r);
      const T = (2 * Math.PI * r) / speed;
      return [
        { label: 'Orbit speed', value: speed / 1000, unit: 'km/s' },
        { label: 'Time for one orbit', value: T / 60, unit: 'minutes' },
        { label: 'Orbits per day', value: 86400 / T, unit: '' },
      ];
    },
  },
  {
    id: 'newton',
    icon: '🍎',
    title: 'Gravity between two objects',
    formula: 'F = G · m₁ · m₂ / d²',
    explain: 'Newton’s law: every mass pulls on every other mass.',
    fields: [
      { key: 'm1', label: 'Mass 1', unit: 'kg', def: 70 },
      { key: 'm2', label: 'Mass 2', unit: 'kg', def: 5.972e24 },
      { key: 'd', label: 'Distance between centres', unit: 'm', def: 6.371e6 },
    ],
    compute: (v) => [{ label: 'Pulling force', value: (G * v.m1 * v.m2) / (v.d * v.d), unit: 'N' }],
  },
  {
    id: 'rocket',
    icon: '⛽',
    title: 'Rocket speed (Tsiolkovsky)',
    formula: 'Δv = Isp · g₀ · ln(m₀ / m_f)',
    explain: 'How much speed a rocket gains by burning its fuel. m₀ = full mass, m_f = empty mass.',
    fields: [
      { key: 'isp', label: 'Engine efficiency (Isp)', unit: 's', def: 450 },
      { key: 'm0', label: 'Full mass (with fuel)', unit: 'kg', def: 10000 },
      { key: 'mf', label: 'Empty mass (no fuel)', unit: 'kg', def: 3000 },
    ],
    validate: (v) => (v.mf <= 0 || v.m0 <= v.mf ? 'Full mass must be bigger than empty mass.' : ''),
    compute: (v) => {
      const dv = v.isp * G0 * Math.log(v.m0 / v.mf);
      return [
        { label: 'Speed gained (Δv)', value: dv, unit: 'm/s' },
        { label: 'In km/s', value: dv / 1000, unit: 'km/s' },
        { label: 'Fuel burned', value: v.m0 - v.mf, unit: 'kg' },
      ];
    },
  },
  {
    id: 'radio',
    icon: '📡',
    title: 'Radio delay to Earth',
    formula: 't = d / c',
    explain: 'Radio travels at the speed of light. Moon ≈ 384,400 km. Mars ≈ 55 to 400 million km.',
    fields: [{ key: 'dist', label: 'Distance to Earth', unit: 'km', def: 384400 }],
    compute: (v) => {
      const t = (v.dist * 1000) / C;
      return [
        { label: 'One-way delay', value: t, unit: 'seconds' },
        { label: 'In minutes', value: t / 60, unit: 'min' },
        { label: 'Question → answer (round trip)', value: (2 * t) / 60, unit: 'min' },
      ];
    },
  },
  {
    id: 'solar',
    icon: '☀️',
    title: 'Solar panel power',
    formula: 'P = irradiance × area × efficiency',
    explain: 'Sunlight is weaker on Mars (about 590 W/m²) than at the Moon (about 1,361 W/m²).',
    fields: [
      bodyField,
      { key: 'area', label: 'Panel area', unit: 'm²', def: 20 },
      { key: 'eff', label: 'Panel efficiency', unit: '%', def: 25 },
    ],
    compute: (v) => {
      const p = BODIES[v.body].irradiance * v.area * (v.eff / 100);
      return [
        { label: 'Power in full sun', value: p, unit: 'W' },
        { label: 'Energy in 10 sun-hours', value: (p * 10) / 1000, unit: 'kWh' },
      ];
    },
  },
  {
    id: 'crew',
    icon: '👩‍🚀',
    title: 'Crew supplies for a mission',
    formula: 'supplies = crew × days × daily need',
    explain: 'Rough planning numbers: about 0.84 kg oxygen, 3.5 L drinking water and 0.6 kg food per person per day.',
    fields: [
      { key: 'crew', label: 'Crew members', unit: '', def: 4 },
      { key: 'days', label: 'Mission length', unit: 'days', def: 7 },
    ],
    compute: (v) => [
      { label: 'Oxygen needed', value: v.crew * v.days * 0.84, unit: 'kg' },
      { label: 'Drinking water needed', value: v.crew * v.days * 3.5, unit: 'litres' },
      { label: 'Food needed', value: v.crew * v.days * 0.6, unit: 'kg' },
    ],
  },
  {
    id: 'jump',
    icon: '🦘',
    title: 'Jump height',
    formula: 'h = v² / (2·g)',
    explain: 'The same jump goes much higher where gravity is weak.',
    fields: [bodyField, { key: 'speed', label: 'Take-off speed', unit: 'm/s', def: 3 }],
    compute: (v) => {
      const g = surfaceG(BODIES[v.body]);
      return [
        { label: 'Jump height', value: (v.speed * v.speed) / (2 * g), unit: 'm' },
        { label: 'Same jump on Earth', value: (v.speed * v.speed) / (2 * G0), unit: 'm' },
      ];
    },
  },
  {
    id: 'energy',
    icon: '💥',
    title: 'Kinetic energy',
    formula: 'E = ½ · m · v²',
    explain: 'Moving things carry energy. Double the speed and the energy becomes four times bigger!',
    fields: [
      { key: 'mass', label: 'Mass', unit: 'kg', def: 1000 },
      { key: 'speed', label: 'Speed', unit: 'm/s', def: 100 },
    ],
    compute: (v) => [
      { label: 'Energy', value: 0.5 * v.mass * v.speed * v.speed, unit: 'J' },
      { label: 'In kilojoules', value: (0.5 * v.mass * v.speed * v.speed) / 1000, unit: 'kJ' },
    ],
  },
];
