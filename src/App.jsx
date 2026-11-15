import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Navbar from './components/Navbar.jsx';
import StarField from './components/StarField.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import AuthClassroomGate from './components/AuthClassroomGate.jsx';
import RoleSelect from './components/RoleSelect.jsx';
import { CrewProvider } from './hooks/useCrew.jsx';
import Home from './pages/Home.jsx';
import ShuttleCockpit from './pages/ShuttleCockpit.jsx';
import HowToPlay from './pages/HowToPlay.jsx';
import Profile from './pages/Profile.jsx';
import MissionControl from './pages/MissionControl.jsx';
import ScienceCenter from './pages/ScienceCenter.jsx';
import MissionReport from './pages/MissionReport.jsx';
import About from './pages/About.jsx';
import NotFound from './pages/NotFound.jsx';
import { useApp } from './hooks/useApp.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function readEduSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem('astra_edu_session') || 'null');
    return parsed && parsed.username ? parsed : null;
  } catch {
    return null;
  }
}

export default function App() {
  const { settings, profile, updateProfile } = useApp();
  const [eduSession, setEduSession] = useState(readEduSession);

  // مزامنة الجلسة لو حصل تسجيل خروج أو تغيير في تبويب تاني
  useEffect(() => {
    const syncSession = () => setEduSession(readEduSession());
    window.addEventListener('storage', syncSession);
    window.addEventListener('astra_session_change', syncSession);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('astra_session_change', syncSession);
    };
  }, []);

  const handleAuthenticated = (session) => {
    setEduSession(session);
    if (session?.username) {
      updateProfile({
        nickname: session.username,
        ...(session.classTeam ? { classTeam: session.classTeam } : {}),
      });
    }
  };

  // The astronaut picks a real NASA-style role once after signing in.
  const handleRolePicked = (role) => {
    if (!eduSession) return;
    const next = { ...eduSession, role };
    try {
      localStorage.setItem('astra_edu_session', JSON.stringify(next));
      window.dispatchEvent(new Event('astra_session_change'));
    } catch {
      // keep going with the in-memory session
    }
    setEduSession(next);
  };

  return (
    <MotionConfig reducedMotion={settings.reducedMotion ? 'always' : 'user'}>
      <ErrorBoundary>
        <CrewProvider session={eduSession} avatar={profile.avatar}>
        {!eduSession ? (
          <AuthClassroomGate onAuthenticated={handleAuthenticated} />
        ) : !eduSession.role ? (
          <RoleSelect session={eduSession} avatar={profile.avatar} onConfirm={handleRolePicked} />
        ) : (
          <>
            <a href="#main" className="skip-link">
              Skip to main content
            </a>
            <StarField />
            <Navbar />
            <ScrollToTop />
            <main id="main" tabIndex={-1}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shuttle" element={<ShuttleCockpit />} />
                <Route path="/how-to-play" element={<HowToPlay />} />
                <Route path="/profile" element={<Profile />} />
                {/* Moon/Mars is now chosen inside the shuttle cockpit */}
                <Route path="/planets" element={<Navigate to="/shuttle" replace />} />
                <Route path="/briefing" element={<Navigate to="/shuttle" replace />} />
                <Route path="/mission" element={<MissionControl />} />
                <Route path="/science" element={<ScienceCenter />} />
                <Route path="/report" element={<MissionReport />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
              ExoLife is an independent educational simulation and is not affiliated with NASA. Game values are simulated. NASA data is credited on the{' '}
              <Link to="/about" className="underline">
                About page
              </Link>
              .
            </footer>
          </>
        )}
        </CrewProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}