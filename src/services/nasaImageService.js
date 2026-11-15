/**
 * Looks up a REAL NASA photo for a map object in the NASA Image and Video Library
 * (https://images.nasa.gov, public API, no key needed).
 *
 * Nothing is bundled with the game: the photo is found when you open the info panel.
 * We only accept a result whose title / description mentions one of the `match` words,
 * so the picture really is of that object. If nothing matches, or NASA is unreachable,
 * the caller gets a clear status instead of a wrong photo.
 *
 * resolveNasaImage(entry) → Promise<{ status: 'ok' | 'none' | 'error', image? }>
 */
const API = 'https://images-api.nasa.gov/search';
const TIMEOUT_MS = 9000;
const memory = new Map();

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(`exolife_map_img_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    sessionStorage.setItem(`exolife_map_img_${key}`, JSON.stringify(value));
  } catch {
    /* storage is optional */
  }
}

function pickBest(items, match) {
  const words = (match || []).map((m) => m.toLowerCase());
  let fallback = null;
  for (const item of items) {
    const data = item?.data?.[0];
    const link = item?.links?.find((l) => l.render === 'image') || item?.links?.[0];
    if (!data || !link?.href || data.media_type !== 'image') continue;
    const title = String(data.title || '').toLowerCase();
    const text = `${title} ${String(data.description || '').toLowerCase()} ${(data.keywords || []).join(' ').toLowerCase()}`;
    if (words.length && !words.some((w) => text.includes(w))) continue;
    const entry = { data, link };
    // Prefer a title that names the object over one that only mentions it in passing.
    if (words.some((w) => title.includes(w))) return entry;
    if (!fallback) fallback = entry;
  }
  return fallback;
}

function toImage({ data, link }) {
  const id = data.nasa_id;
  const thumb = link.href;
  const base = thumb.replace(/~(thumb|small|medium|large|orig)\.(jpg|jpeg|png)$/i, '');
  const hasPattern = base !== thumb;
  return {
    nasaId: id,
    title: data.title,
    center: data.center || 'NASA',
    date: data.date_created ? String(data.date_created).slice(0, 10) : '',
    pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(id)}`,
    // Try the medium picture first, then the thumbnail NASA gave us.
    sources: hasPattern ? [`${base}~medium.jpg`, `${base}~large.jpg`, thumb] : [thumb],
  };
}

export function resolveNasaImage(entry) {
  const key = entry.id;
  if (memory.has(key)) return memory.get(key);
  const cached = readCache(key);
  if (cached) {
    const p = Promise.resolve(cached);
    memory.set(key, p);
    return p;
  }
  const promise = (async () => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    try {
      const url = `${API}?q=${encodeURIComponent(entry.query)}&media_type=image&page_size=15`;
      const res = await fetch(url, { signal: ctrl?.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const best = pickBest(json?.collection?.items || [], entry.match);
      const result = best ? { status: 'ok', image: toImage(best) } : { status: 'none' };
      writeCache(key, result);
      return result;
    } catch {
      memory.delete(key); // allow a retry later
      return { status: 'error' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  })();
  memory.set(key, promise);
  return promise;
}

export function forgetNasaImage(entry) {
  memory.delete(entry.id);
  try {
    sessionStorage.removeItem(`exolife_map_img_${entry.id}`);
  } catch {
    /* ignore */
  }
}
