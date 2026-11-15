/**
 * The crew = the astronauts who are in the SAME server (same server code) right now.
 * Each player announces { name, role, avatar } on the server room every few seconds
 * (same cross-device room the 3D base uses), and players who go quiet are removed.
 * Nobody outside the server can ever appear in the crew list.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { connectServerRoom } from '../services/serverRoom.js';
import { getRole, ROLES } from '../data/astronautRoles.js';

const HEARTBEAT_MS = 4000;
const STALE_MS = 13000;

const CrewContext = createContext({ crew: [], me: null, takenBy: {}, serverCode: '' });

/** Data from other players is untrusted: keep only the fields we expect. */
function cleanMember(m) {
  if (!m || typeof m !== 'object') return null;
  const id = String(m.id || '').trim().toLowerCase().slice(0, 32);
  const name = String(m.name || '').trim().slice(0, 24);
  const role = getRole(m.role)?.id;
  if (!id || !name || !role) return null;
  return { id, name, role, avatar: String(m.avatar || 'aurora').slice(0, 20) };
}

export function CrewProvider({ session, avatar, children }) {
  const serverCode = String(session?.serverCode || session?.classTeam || '').trim().toUpperCase();
  const username = session?.username || '';
  const role = session?.role || '';

  const me = useMemo(
    () => (username && getRole(role) ? { id: username.toLowerCase(), name: username, role, avatar: avatar || 'aurora' } : null),
    [username, role, avatar],
  );
  const [others, setOthers] = useState([]);
  const meRef = useRef(me);
  meRef.current = me;
  const announceRef = useRef(() => {});

  useEffect(() => {
    if (!serverCode || !username) {
      setOthers([]);
      return undefined;
    }
    const known = new Map();
    const publish = () =>
      setOthers([...known.values()].sort((a, b) => a.joined - b.joined).map((e) => e.member));

    let room = null;
    const announce = () => {
      const m = meRef.current;
      if (m && room) room.send({ type: 'crew', member: m });
    };
    announceRef.current = announce;

    room = connectServerRoom(serverCode, (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'crew-bye') {
        if (known.delete(String(msg.id || '').toLowerCase())) publish();
        return;
      }
      if (msg.type !== 'crew') return;
      const member = cleanMember(msg.member);
      if (!member || member.id === meRef.current?.id) return;
      const prev = known.get(member.id);
      known.set(member.id, { member, seen: Date.now(), joined: prev?.joined ?? Date.now() });
      if (!prev || JSON.stringify(prev.member) !== JSON.stringify(member)) publish();
      if (!prev) announce(); // say hello back so newcomers see us straight away
    });

    const tick = setInterval(() => {
      announce();
      const now = Date.now();
      let pruned = false;
      for (const [id, e] of known) {
        if (now - e.seen > STALE_MS) {
          known.delete(id);
          pruned = true;
        }
      }
      if (pruned) publish();
    }, HEARTBEAT_MS);
    const early = [setTimeout(announce, 1200), setTimeout(announce, 2600)];

    const bye = () => {
      const m = meRef.current;
      if (m && room) room.send({ type: 'crew-bye', id: m.id });
    };
    window.addEventListener('beforeunload', bye);

    return () => {
      clearInterval(tick);
      early.forEach(clearTimeout);
      window.removeEventListener('beforeunload', bye);
      bye();
      room.leave();
      room = null;
      announceRef.current = () => {};
      setOthers([]);
    };
  }, [serverCode, username]);

  // Tell the server straight away when this player picks or changes a role or avatar.
  useEffect(() => {
    if (me) announceRef.current();
  }, [me]);

  const value = useMemo(() => {
    const takenBy = {};
    for (const o of others) if (!takenBy[o.role]) takenBy[o.role] = o.name;
    return { crew: me ? [me, ...others] : others, me, takenBy, serverCode };
  }, [me, others, serverCode]);

  return <CrewContext.Provider value={value}>{children}</CrewContext.Provider>;
}

export function useCrew() {
  return useContext(CrewContext);
}

export { ROLES };
