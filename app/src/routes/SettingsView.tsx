import { useEffect, useRef, useState } from 'react';
import {
  HardDrive, ShieldCheck, FolderPlus, Trash2, Download, Upload, Info, Plus,
} from 'lucide-react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { estimateUsage, requestPersist, isPersisted, clearAllData } from '@/lib/db';
import { buildBackup, restoreBackup, downloadBlob, buildCombinedMarkdown } from '@/lib/export';
import { toast } from '@/stores/useToastStore';
import { confirmDialog } from '@/stores/useConfirmStore';
import { fmtBytes } from '@/lib/format';
import InstallPrompt from '@/components/InstallPrompt';
import type { BackupFile } from '@/types';

export default function SettingsView(): JSX.Element {
  const { folders, addFolder, removeFolder, meetings, load } = useMeetingStore();
  const [persisted, setPersisted] = useState(false);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshStorage = () => {
    void isPersisted().then(setPersisted);
    void estimateUsage().then(setUsage);
  };
  useEffect(refreshStorage, []);

  const onPersist = async () => {
    const ok = await requestPersist();
    setPersisted(ok);
    toast(ok ? '영속 저장이 활성화되었습니다.' : '브라우저가 영속 저장을 거부했습니다.', ok ? 'success' : 'error');
  };

  const onExport = async (includeAudio: boolean) => {
    // 오디오 포함 + 사용량이 크면 시간/용량 경고
    if (includeAudio && usage && usage.usage > 50 * 1024 * 1024) {
      const ok = await confirmDialog({
        message: `오디오 포함 백업은 약 ${fmtBytes(usage.usage)}로 큽니다.\n시간이 걸릴 수 있어요. 계속할까요?`,
        confirmLabel: '계속',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const backup = await buildBackup(folders, includeAudio);
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = includeAudio ? '' : '-text';
      downloadBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), `meetnote-backup${suffix}-${stamp}.json`);
      toast('백업 파일을 내보냈습니다.', 'success');
    } catch {
      toast('백업 생성 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onImportFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupFile;
      const n = await restoreBackup(data);
      // 폴더 병합
      if (Array.isArray(data.folders)) {
        const existing = new Set(folders.map((f) => f.id));
        for (const f of data.folders) {
          if (f && typeof f.id === 'string' && !existing.has(f.id)) addFolder(f.name);
        }
      }
      await load();
      refreshStorage();
      toast(`${n}건을 복원했습니다.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '복원 실패', 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onCombined = async () => {
    setBusy(true);
    try {
      const md = await buildCombinedMarkdown();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `meetnote-all-${stamp}.md`);
      toast('합본을 내보냈습니다.', 'success');
    } catch {
      toast('내보내기 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onClearAll = async () => {
    const ok = await confirmDialog({ message: '모든 회의록·메모·설정을 삭제합니다.\n되돌릴 수 없습니다. 계속할까요?', confirmLabel: '전체 삭제', danger: true });
    if (!ok) return;
    await clearAllData();
    toast('모든 데이터를 삭제했습니다.');
    setTimeout(() => window.location.reload(), 600);
  };

  const usedPct = usage && usage.quota > 0 ? Math.min(100, (usage.usage / usage.quota) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-6">
      {/* 저장소 */}
      <Section title="저장소" Icon={HardDrive}>
        <Row>
          <span className="text-sm text-fg">회의록 {meetings.length}건</span>
          {usage && <span className="text-xs text-muted">{fmtBytes(usage.usage)} 사용</span>}
        </Row>
        {usage && (
          <div className="h-1.5 rounded-full bg-divider/40 overflow-hidden mt-1">
            <div className="h-full bg-primary rounded-full" style={{ width: `${usedPct}%` }} />
          </div>
        )}
        <Row>
          <span className="flex items-center gap-1.5 text-sm text-fg">
            <ShieldCheck size={16} className={persisted ? 'text-primary' : 'text-muted'} />
            영속 저장 {persisted ? '켜짐' : '꺼짐'}
          </span>
          {!persisted && (
            <button type="button" onClick={onPersist} className="text-xs font-bold text-primary px-3 py-1.5 rounded-full bg-primary/10">
              활성화
            </button>
          )}
        </Row>
        <p className="text-xs text-muted leading-relaxed">
          영속 저장을 켜면 브라우저가 공간 부족 시 데이터를 임의로 지우지 않습니다.
          개인 기기에만 저장되므로, 중요한 회의록은 아래에서 정기적으로 백업하세요.
        </p>
      </Section>

      {/* 폴더 */}
      <Section title="폴더" Icon={FolderPlus}>
        <div className="flex items-center gap-2">
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newFolder.trim()) { addFolder(newFolder); setNewFolder(''); } }}
            placeholder="새 폴더 이름"
            className="flex-1 bg-surface border border-divider rounded-full px-3 py-2 text-sm outline-none text-fg"
          />
          <button
            type="button"
            onClick={() => { if (newFolder.trim()) { addFolder(newFolder); setNewFolder(''); } }}
            aria-label="폴더 추가"
            className="w-10 h-10 grid place-items-center rounded-full bg-primary text-white flex-none"
          >
            <Plus size={18} />
          </button>
        </div>
        {folders.length > 0 && (
          <ul className="space-y-1.5 mt-2">
            {folders.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-xl bg-surface border border-divider px-3 py-2">
                <span className="text-sm text-fg">{f.name}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirmDialog({ message: `'${f.name}' 폴더를 삭제할까요?\n안의 회의록은 미분류로 이동합니다.`, confirmLabel: '삭제', danger: true });
                    if (ok) void removeFolder(f.id);
                  }}
                  aria-label="폴더 삭제"
                  className="text-muted"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 백업 / 복원 */}
      <Section title="백업 · 복원" Icon={Download}>
        <p className="text-xs text-muted leading-relaxed">
          모든 회의록과 오디오를 하나의 JSON 파일로 저장하거나 복원합니다. 기기 변경·초기화 전에 꼭 백업하세요.
        </p>
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={() => void onExport(true)} disabled={busy} className="flex-1 flex items-center justify-center gap-2 rounded-full bg-primary text-white text-sm font-semibold py-2.5 disabled:opacity-50">
            <Download size={16} /> 전체 백업
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex-1 flex items-center justify-center gap-2 rounded-full border border-divider text-fg text-sm font-semibold py-2.5 disabled:opacity-50">
            <Upload size={16} /> 복원
          </button>
        </div>
        <button type="button" onClick={() => void onExport(false)} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-full border border-divider text-muted text-xs font-medium py-2 disabled:opacity-50">
          텍스트만 백업 (오디오 제외 · 가벼움)
        </button>
        <button type="button" onClick={() => void onCombined()} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-full border border-divider text-muted text-xs font-medium py-2 disabled:opacity-50">
          모든 회의록 합본 (.md)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); }}
        />
      </Section>

      {/* 앱 설치 */}
      <div><InstallPrompt /></div>

      {/* 정보 */}
      <Section title="정보" Icon={Info}>
        <p className="text-sm text-fg">MeetNote 회의록 v1.0.0</p>
        <p className="text-xs text-muted leading-relaxed">
          서버·계정·비용 없이 기기에서만 동작하는 개인용 회의록 앱입니다.
          녹음·자막·요약·저장 모두 오프라인에서 처리됩니다. 실시간 자막은 Chrome·Edge에서 가장 잘 동작합니다.
        </p>
      </Section>

      {/* 위험 구역 */}
      <section className="space-y-2 pb-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-accent uppercase tracking-wide">
          <Trash2 size={15} /> 데이터 초기화
        </h2>
        <p className="text-xs text-muted leading-relaxed">삭제 전 위에서 백업을 권장합니다.</p>
        <button type="button" onClick={() => void onClearAll()} disabled={busy} className="w-full rounded-full border border-accent text-accent text-sm font-semibold py-2.5 disabled:opacity-50">
          모든 데이터 삭제
        </button>
      </section>
    </div>
  );
}

function Section({ title, Icon, children }: { title: string; Icon: typeof Info; children: React.ReactNode }): JSX.Element {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-muted uppercase tracking-wide">
        <Icon size={15} /> {title}
      </h2>
      <div className="rounded-2xl bg-bg space-y-2">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="flex items-center justify-between gap-2">{children}</div>;
}
