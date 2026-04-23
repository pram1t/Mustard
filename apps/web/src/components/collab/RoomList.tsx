import Link from 'next/link';
import type { Room } from '../../lib/collab-client.js';

const MODE_DOT: Record<string, string> = {
  plan: 'bg-blue-400',
  code: 'bg-emerald-400',
  ask: 'bg-violet-400',
  auto: 'bg-amber-400',
};

export interface RoomListProps {
  rooms: Room[];
}

export default function RoomList(props: RoomListProps) {
  if (props.rooms.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
        No rooms yet. Create one to get started.
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {props.rooms.map(room => (
        <li
          key={room.id}
          className="rounded border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-600 transition"
        >
          <Link href={`/collab/${room.id}`} className="block">
            <header className="flex items-center gap-2">
              <span
                aria-hidden
                className={`inline-block w-2 h-2 rounded-full ${MODE_DOT[room.config.defaultMode] ?? 'bg-zinc-500'}`}
              />
              <h3 className="text-base font-semibold text-zinc-100 truncate">
                {room.name}
              </h3>
            </header>
            <p className="text-xs text-zinc-500 mt-1 truncate">
              {room.projectPath ?? '(no project path)'}
            </p>
            <div className="text-[11px] text-zinc-600 mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>mode: {room.config.defaultMode}</span>
              <span>visibility: {room.config.visibility}</span>
              <span>owner: {room.ownerId}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
