import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Mic } from 'lucide-react';
import TopBar from '@/components/TopBar';
import TabBar from '@/components/TabBar';
import Toast from '@/components/Toast';
import UpdateToast from '@/components/UpdateToast';
import ConfirmDialog from '@/components/ConfirmDialog';
import Onboarding from '@/components/Onboarding';
import RecoveryPrompt from '@/components/RecoveryPrompt';
import { RecorderProvider, useRecorderContext } from '@/components/RecorderProvider';
import RecordView from '@/routes/RecordView';
import LibraryView from '@/routes/LibraryView';
import SettingsView from '@/routes/SettingsView';
import MeetingDetail from '@/routes/MeetingDetail';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { fmtTime } from '@/lib/format';

// 다른 탭에 있을 때도 녹음이 진행 중임을 알리는 배너 (탭하면 녹음 화면으로)
function RecordingIndicator(): JSX.Element | null {
  const { rec } = useRecorderContext();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const busy = rec.state !== 'idle';
  if (!busy || pathname === '/') return null;
  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      className="flex-none flex items-center justify-center gap-2 py-1.5 bg-accent text-white text-xs font-semibold"
    >
      <Mic size={14} className="rec-pulse" />
      {rec.state === 'recording' ? '녹음 중' : '일시정지됨'} · {fmtTime(rec.elapsedMs)} · 탭하여 돌아가기
    </button>
  );
}

function MainLayout(): JSX.Element {
  return (
    <div className="flex flex-col h-full">
      <TopBar />
      <RecordingIndicator />
      <main className="flex-1 min-h-0 bg-bg">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

export default function App(): JSX.Element {
  const load = useMeetingStore((s) => s.load);
  useEffect(() => { void load(); }, [load]);

  return (
    <RecorderProvider>
      <div className="h-full bg-bg text-fg">
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<RecordView />} />
            <Route path="/library" element={<LibraryView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
          <Route path="/m/:id" element={<MeetingDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toast />
        <UpdateToast />
        <ConfirmDialog />
        <Onboarding />
        <RecoveryPrompt />
      </div>
    </RecorderProvider>
  );
}
