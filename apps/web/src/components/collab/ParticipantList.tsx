import type { Participant } from '../../lib/collab-client.js';

const TYPE_BADGE: Record<Participant['type'], string> = {
  human: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  ai: 'bg-purple-900/40 text-purple-300 border-purple-700/50',
};

const ROLE_BADGE: Record<Participant['role'], string> = {
  owner: 'text-amber-300',
  admin: 'text-rose-300',
  member: 'text-zinc-400',
  viewer: 'text-zinc-500',
};

export interface ParticipantListProps {
  participants: Participant[];
  onLeave?: (participant: Participant) => void;
  currentParticipantId?: string;
}

export default function ParticipantList(props: ParticipantListProps): JSX.Element {
  const { participants, onLeave, currentParticipantId } = props;
  if (participants.length === 0) {
    return (
      <div className="text-sm text-zinc-500 italic">No participants yet.</div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {participants.map(p => {
        const isMe = p.id === currentParticipantId;
        return (
          <li
            key={p.id}
            className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-900/40 border border-zinc-800"
          >
            <span
              aria-hidden
              className={`inline-block w-2 h-2 rounded-full ${
                p.status === 'online' ? 'bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            <span className="font-medium text-zinc-200 truncate">{p.name}</span>
            {isMe ? <span className="text-xs text-zinc-500">(you)</span> : null}
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${TYPE_BADGE[p.type]}`}
            >
              {p.type}
            </span>
            <span className={`text-xs ml-1 ${ROLE_BADGE[p.role]}`}>
              {p.role}
            </span>
            {onLeave && isMe ? (
              <button
                type="button"
                onClick={() => onLeave(p)}
                className="ml-auto text-xs text-zinc-500 hover:text-rose-400"
              >
                Leave
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
