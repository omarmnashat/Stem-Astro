import { useCallback, useEffect, useState } from 'react';
import { forgetNasaImage, resolveNasaImage } from '../../services/nasaImageService.js';

/** Real NASA photo for the object, fetched from NASA's image library. */
function NasaPhoto({ entry }) {
  const [state, setState] = useState({ status: 'loading' });
  const [srcIndex, setSrcIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    setSrcIndex(0);
    if (!entry.query) {
      setState({ status: 'none' });
      return undefined;
    }
    resolveNasaImage(entry).then((res) => {
      if (alive) setState(res);
    });
    return () => {
      alive = false;
    };
  }, [entry, attempt]);

  const retry = useCallback(() => {
    forgetNasaImage(entry);
    setAttempt((n) => n + 1);
  }, [entry]);

  if (state.status === 'loading') {
    return (
      <div className="sm-photo sm-photo-empty" role="status">
        <span className="sm-spinner" aria-hidden="true" />
        <span>Contacting NASA image library…</span>
      </div>
    );
  }
  if (state.status === 'none') {
    return (
      <div className="sm-photo sm-photo-empty">
        <span aria-hidden="true" className="sm-photo-icon">🔭</span>
        <span>No NASA photo is available for this object.</span>
      </div>
    );
  }
  if (state.status === 'error' || !state.image || srcIndex >= state.image.sources.length) {
    return (
      <div className="sm-photo sm-photo-empty">
        <span aria-hidden="true" className="sm-photo-icon">📡</span>
        <span>Could not reach NASA right now.</span>
        <button type="button" className="btn btn-ghost !min-h-[36px] !px-4 !py-1 text-sm" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }
  const img = state.image;
  return (
    <figure className="sm-photo-wrap">
      <div className="sm-photo">
        <img
          key={img.sources[srcIndex]}
          src={img.sources[srcIndex]}
          alt={`NASA photo: ${img.title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setSrcIndex((i) => i + 1)}
        />
        <span className="sm-photo-badge">Real NASA photo</span>
      </div>
      <figcaption className="sm-photo-cap">
        {img.title}
        <br />
        <a href={img.pageUrl} target="_blank" rel="noreferrer noopener">
          NASA Image and Video Library · {img.center} · {img.nasaId}
        </a>
      </figcaption>
    </figure>
  );
}

/** Slides in from the right (bottom on phones): real photo + facts about the chosen object. */
export default function MapInfoPanel({ item, open, onClose, onEnter, narrow }) {
  const hasInfo = Boolean(item && item.summary);
  return (
    <aside
      className={`sm-panel ${open ? 'is-open' : ''} ${narrow ? 'is-narrow' : ''}`}
      role="dialog"
      aria-label={item ? `${item.name} information` : 'Object information'}
      aria-hidden={!open}
    >
      <button type="button" className="sm-panel-close" onClick={onClose} aria-label="Close information" data-nosound tabIndex={open ? 0 : -1}>
        ✕
      </button>
      {item && (
        <div className="sm-panel-body">
          <p className={`sm-kicker sm-tone-text-${item.tone}`}>{item.type}</p>
          <h3 className="sm-panel-title">{item.name}</h3>
          <p className="sm-distance">📍 {item.distance}</p>

          {hasInfo ? (
            <>
              <NasaPhoto key={item.id} entry={item} />
              {item.facts?.length > 0 && (
                <dl className="sm-facts">
                  {item.facts.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="sm-summary">{item.summary}</p>
              {item.fun && (
                <p className="sm-fun">
                  <b>Did you know?</b> {item.fun}
                </p>
              )}
              {onEnter && item.spec && (
                <button type="button" className="btn btn-primary w-full" onClick={() => onEnter(item)} data-nosound>
                  🚀 {item.id === 'milkyway' ? 'Fly home to the Milky Way' : 'Enter this galaxy'}
                </button>
              )}
            </>
          ) : (
            <div className="sm-photo sm-photo-empty">
              <span aria-hidden="true" className="sm-photo-icon">🛰️</span>
              <span>No information about this object yet.</span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
