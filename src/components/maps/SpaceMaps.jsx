import { useMemo, useState } from 'react';
import MapStage from './MapStage.jsx';
import { GALAXIES, MILKY_WAY_OBJECTS, TONES } from '../../data/spaceMapData.js';
import { playSound } from '../../services/soundService.js';

const MILKY_WAY_BG = {
  spec: { kind: 'spiral', arms: 4, bar: true, tilt: 1, rot: 0.55, core: '#ffe3a6', arm: '#a9c6ff' },
  density: 3.4,
  radius: 0.46,
};

const HOME_MW = { x: 36, y: 67 };
const HOME_GALAXIES = { x: 50, y: 68 };
const HOME_INSIDE = { x: 50, y: 60 };

function Legend() {
  return (
    <ul className="sm-legend" aria-label="Map legend">
      {Object.entries(TONES).map(([key, t]) => (
        <li key={key}>
          <span className="sm-legend-dot" style={{ '--c': t.color }} aria-hidden="true" />
          {t.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Space Science → Maps
 *   • Our Galaxy: the Milky Way with famous stars, nebulae and black holes
 *   • Other Galaxies: neighbours like Andromeda; "Enter" one to explore what is inside
 */
export default function SpaceMaps() {
  // view: 'milkyway' | 'galaxies' | 'galaxy:<id>'
  const [view, setView] = useState('milkyway');
  const [from, setFrom] = useState(null); // 'galaxies' when we flew home from the galaxy map

  const galaxy = useMemo(
    () => (view.startsWith('galaxy:') ? GALAXIES.find((g) => g.id === view.slice(7)) : null),
    [view],
  );

  const choose = (next) => {
    playSound('panel');
    setFrom(null);
    setView(next);
  };

  const enterGalaxy = (item) => {
    playSound('zoom');
    setFrom('galaxies');
    setView(item.id === 'milkyway' ? 'milkyway' : `galaxy:${item.id}`);
  };

  const backToGalaxies = () => {
    playSound('switch');
    setFrom(null);
    setView('galaxies');
  };

  const inOur = view === 'milkyway' && from === null;
  const crumb =
    view === 'milkyway'
      ? from === 'galaxies'
        ? ['Other Galaxies', 'Milky Way']
        : ['Our Galaxy']
      : view === 'galaxies'
        ? ['Other Galaxies']
        : ['Other Galaxies', galaxy?.name];

  return (
    <div className="sm-root">
      <div className="sm-choices" role="group" aria-label="Choose a map">
        <button type="button" className={`sm-choice ${inOur ? 'is-active' : ''}`} onClick={() => choose('milkyway')} aria-pressed={inOur}>
          <span className="sm-choice-icon" aria-hidden="true">🌌</span>
          <span>
            <b>Our Galaxy</b>
            <small>The Milky Way: stars, nebulae &amp; black holes</small>
          </span>
        </button>
        <button type="button" className={`sm-choice ${!inOur ? 'is-active' : ''}`} onClick={() => choose('galaxies')} aria-pressed={!inOur}>
          <span className="sm-choice-icon" aria-hidden="true">🔭</span>
          <span>
            <b>Other Galaxies</b>
            <small>Andromeda, the Magellanic Clouds &amp; more</small>
          </span>
        </button>
      </div>

      <div className="sm-hint" role="note">
        <span className="sm-hint-icon" aria-hidden="true">👆</span>
        <div>
          <b>This map is interactive!</b>
          <p>
            {view === 'galaxies'
              ? 'Tap any galaxy to fly the rocket there and read facts and a real NASA photo about it. Then press “Enter this galaxy” to look inside.'
              : 'Tap any glowing star, nebula or black hole. The rocket flies to it, the map zooms in, and a panel opens with facts and a real NASA photo.'}
          </p>
        </div>
      </div>

      <div className="sm-bar">
        <p className="sm-crumb" aria-live="polite">
          {crumb.map((c, i) => (
            <span key={`${c}-${i}`}>
              {i > 0 && <span className="sm-crumb-sep"> › </span>}
              {c}
            </span>
          ))}
        </p>
        {(galaxy || from === 'galaxies') && (
          <button type="button" className="btn btn-ghost !min-h-[40px] !px-4 !py-1 text-sm" onClick={backToGalaxies} data-nosound>
            ← Back to Other Galaxies
          </button>
        )}
      </div>

      {view === 'milkyway' && (
        <MapStage key={`mw-${from}`} mode="square" bg={MILKY_WAY_BG} showArms objects={MILKY_WAY_OBJECTS} home={HOME_MW} />
      )}
      {view === 'galaxies' && <MapStage key="galaxies" mode="wide" objects={GALAXIES} home={HOME_GALAXIES} onEnter={enterGalaxy} />}
      {galaxy && (
        <MapStage
          key={galaxy.id}
          mode="square"
          bg={{ spec: galaxy.spec, density: 3, radius: 0.46 }}
          objects={galaxy.objects || []}
          home={HOME_INSIDE}
          emptyText={`No information yet. We have not mapped any objects inside the ${galaxy.name}.`}
        />
      )}

      <div className="sm-foot">
        {view !== 'galaxies' && <Legend />}
        <p>
          {view === 'galaxies'
            ? 'Tap a galaxy: the rocket flies there and a NASA photo opens on the right. Press “Enter this galaxy” to look inside.'
            : 'Tap an object: the rocket flies there, the map zooms in, and a real NASA photo opens on the right.'}{' '}
          Positions are schematic (not to scale). Photos come live from the NASA Image and Video Library.
        </p>
      </div>
    </div>
  );
}
