import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import MissionSimulation from '../components/simulation/MissionSimulation.jsx';
import { PauseOverlay, TeacherPanel, TutorialCoach } from '../components/Overlays.jsx';
import { useApp } from '../hooks/useApp.jsx';

const TUTORIAL_FLAG = 'exolife.tutorial.seen.v1';
const seenTutorial = () => {
  try {
    return window.localStorage.getItem(TUTORIAL_FLAG) === '1';
  } catch {
    return true;
  }
};
const markTutorialSeen = () => {
  try {
    window.localStorage.setItem(TUTORIAL_FLAG, '1');
  } catch {
    /* ignore */
  }
};

export default function MissionControl() {
  const {
    game,
    settings,
    saveFailed,
    act,
    choose,
    nextDay,
    dismissOutcome,
    pause,
    abandonMission,
    startMission,
    demoPlayDays,
  } = useApp();
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(() => !seenTutorial());
  const [dayNote, setDayNote] = useState('');

  const readyForReport = Boolean(game) && game.status !== 'playing' && !game.lastOutcome;
  useEffect(() => {
    if (!readyForReport) return undefined;
    const t = setTimeout(() => navigate('/report'), 400);
    return () => clearTimeout(t);
  }, [readyForReport, navigate]);

  if (!game) return <Navigate to="/shuttle" replace />;

  const closeTutorial = () => {
    markTutorialSeen();
    setShowTutorial(false);
  };

  const handleEndDay = () => {
    const done = game.day;
    const next = nextDay();
    if (next && next.status === 'playing') {
      setDayNote(`Day ${done} complete! Welcome to Day ${next.day}.`);
    } else {
      setDayNote('');
    }
    return next;
  };

  const restart = () => {
    if (!window.confirm('Restart this mission from Day 1?')) return;
    const planet = game.planet;
    abandonMission();
    startMission(planet);
  };

  const exitHome = () => {
    pause(false);
    navigate('/');
  };

  return (
    <div className="page !max-w-none !px-0 sm:!px-2">
      {showTutorial && <TutorialCoach onClose={closeTutorial} />}
      {game.paused && game.status === 'playing' && (
        <PauseOverlay onResume={() => pause(false)} onRestart={restart} onExit={exitHome} />
      )}

      {saveFailed && (
        <p className="mx-2 mb-2 rounded-xl border border-amber-300/50 bg-amber-300/10 p-3 text-sm text-amber-100" role="status">
          ⚠️ Your browser would not let us save progress. You can keep playing, but the mission may not be there next time.
        </p>
      )}

      {settings.teacherMode && (
        <div className="mx-2 mb-2">
          <TeacherPanel game={game} onDemo={demoPlayDays} />
        </div>
      )}

      <MissionSimulation
        game={game}
        act={act}
        choose={choose}
        nextDay={handleEndDay}
        dismissOutcome={dismissOutcome}
        pause={pause}
        onTutorial={() => setShowTutorial(true)}
        dayNote={dayNote}
        settings={settings}
      />
    </div>
  );
}
