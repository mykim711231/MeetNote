import { NavLink } from 'react-router-dom';
import { Mic, Library, Settings } from 'lucide-react';

const TABS = [
  { to: '/', label: '녹음', Icon: Mic, end: true },
  { to: '/library', label: '기록', Icon: Library, end: false },
  { to: '/settings', label: '설정', Icon: Settings, end: false },
];

export default function TabBar(): JSX.Element {
  return (
    <nav className="flex-none grid grid-cols-3 border-t border-divider bg-surface pb-safe">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-primary' : 'text-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
