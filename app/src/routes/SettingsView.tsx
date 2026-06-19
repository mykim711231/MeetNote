import { useEffect, useRef, useState } from 'react';
import {
  HardDrive, ShieldCheck, Trash2, Download, Upload, Info, Waves,
  Sparkles, ExternalLink, Eye, EyeOff, RefreshCw, Cloud, Copy, Check, Mic, ChevronDown,
} from 'lucide-react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { usePrefStore, AI_PROVIDERS } from '@/stores/usePrefStore';
import { estimateUsage, requestPersist, isPersisted, clearAllData } from '@/lib/db';
import { buildBackup, restoreBackup, downloadBlob, buildCombinedMarkdown } from '@/lib/export';
import { syncMeetings, testConnection, SETUP_SQL } from '@/lib/cloudSync';
import { updateMeta } from '@/lib/db';
import { toast } from '@/stores/useToastStore';
import { confirmDialog } from '@/stores/useConfirmStore';
import { fmtBytes } from '@/lib/format';
import InstallPrompt from '@/components/InstallPrompt';
import HelpModal from '@/components/HelpModal';
import { useRecorderContext } from '@/components/RecorderProvider';
import type { BackupFile } from '@/types';

export default function SettingsView(): JSX.Element {
  const { meetings, load } = useMeetingStore();
  const { rec } = useRecorderContext();
  const { denoise, setDenoise } = usePrefStore();
  const { aiProvider, aiKey, setAiProvider, setAiKey } = usePrefStore();
  const [keyDraft, setKeyDraft] = useState(aiKey);
  const [showKey, setShowKey] = useState(false);
  const activeProvider = AI_PROVIDERS.find((p) => p.id === aiProvider) ?? AI_PROVIDERS[0];

  const { assemblyAiKey, setAssemblyAiKey } = usePrefStore();
  const [aaiKeyDraft, setAaiKeyDraft] = useState(assemblyAiKey);
  const [showAaiKey, setShowAaiKey] = useState(false);

  const { supabaseUrl, supabaseKey, setSupabase } = usePrefStore();
  const [sbUrlDraft, setSbUrlDraft] = useState(supabaseUrl);
  const [sbKeyDraft, setSbKeyDraft] = useState(supabaseKey);
  const [showSbKey, setShowSbKey] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const syncActive = supabaseUrl.length > 0 && supabaseKey.length > 0;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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

  const onSbSave = () => {
    setSupabase(sbUrlDraft, sbKeyDraft);
  };

  const onTestConn = async () => {
    const url = sbUrlDraft.trim().replace(/\/$/, '');
    const key = sbKeyDraft.trim();
    if (!url || !key) { toast('URL과 anon 키를 모두 입력하세요.', 'error'); return; }
    setSyncBusy(true);
    try {
      await testConnection(url, key);
      setSupabase(url, key);
      toast('연결 성공! 동기화 준비됐어요.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '연결 실패', 'error');
    } finally {
      setSyncBusy(false);
    }
  };

  const onSync = async () => {
    if (!syncActive) { toast('설정에서 Supabase URL과 키를 먼저 등록하세요.', 'error'); return; }
    setSyncBusy(true);
    try {
      const result = await syncMeetings(
        supabaseUrl,
        supabaseKey,
        meetings,
        async (meta) => { await updateMeta(meta); await load(); },
      );
      toast(`동기화 완료 — 업로드 ${result.pushed}건, 신규 ${result.pulled}건, 병합 ${result.merged}건`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '동기화 실패', 'error');
    } finally {
      setSyncBusy(false);
    }
  };

  const onCopySql = async () => {
    try { await navigator.clipboard.writeText(SETUP_SQL); setSqlCopied(true); setTimeout(() => setSqlCopied(false), 2000); }
    catch { toast('복사 실패', 'error'); }
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
    const warn = rec.state !== 'idle' ? '⚠️ 지금 녹음이 진행 중입니다. 초기화하면 녹음 데이터도 사라집니다.\n\n' : '';
    const ok = await confirmDialog({ message: `${warn}모든 회의록·메모·설정을 삭제합니다.\n되돌릴 수 없습니다. 계속할까요?`, confirmLabel: '전체 삭제', danger: true });
    if (!ok) return;
    await clearAllData();
    toast('모든 데이터를 삭제했습니다.');
    setTimeout(() => window.location.reload(), 600);
  };

  const usedPct = usage && usage.quota > 0 ? Math.min(100, (usage.usage / usage.quota) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-6">
      {/* 도움말 */}
      <div className="flex items-center justify-center pt-2">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="flex items-center gap-2 text-sm font-semibold text-primary px-4 py-2 rounded-full bg-primary/10 active:scale-95 transition"
        >
          <Info size={16} />
          도움말 보기
        </button>
      </div>

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

      {/* 녹음 */}
      <Section title="녹음" Icon={Waves}>
        <Row>
          <div className="pr-3">
            <p className="text-sm text-fg">노이즈 감소</p>
            <p className="text-xs text-muted leading-relaxed">
              <b>끔(권장)</b>: 회의·먼 화자·TV 등 방 안의 소리를 그대로 담아요.<br />
              켜면 가까운 1:1에서 배경 잡음을 줄이지만, 멀거나 주변 소리는 약해질 수 있어요.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={denoise}
            aria-label="노이즈 감소"
            onClick={() => setDenoise(!denoise)}
            className={`flex-none w-11 h-6 rounded-full relative transition-colors ${denoise ? 'bg-primary' : 'bg-divider'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${denoise ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </Row>
      </Section>

      {/* 고급 기능 아코디언 */}
      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 py-1"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-muted" />
            <span className="text-sm font-bold text-muted uppercase tracking-wide">고급 기능</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-divider text-muted font-medium">
              무료 · 선택
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(aiKey || assemblyAiKey || syncActive) && (
              <span className="text-xs text-primary font-semibold">
                {[aiKey && 'AI 요약', assemblyAiKey && '화자 분리', syncActive && '동기화']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-muted transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {advancedOpen && (
          <div className="space-y-6 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">

      {/* STT 품질 */}
      <Section title="전사 품질" Icon={Mic}>
        <p className="text-xs text-muted leading-relaxed">
          기본은 기기 안에서 처리(무료·오프라인). 클라우드를 쓰면 품질이 높아지고 <b>화자 분리</b>도 됩니다.
          <br /><b>주의:</b> 켜면 오디오가 해당 서비스 서버로 전송됩니다.
        </p>

        {/* Groq Whisper */}
        <div className="rounded-xl bg-surface border border-divider px-3 py-2 space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-fg">Groq Whisper</p>
              <p className="text-xs text-muted">초고속 전사 · AI 요약 키 공유</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${aiKey ? 'bg-primary/10 text-primary' : 'bg-divider text-muted'}`}>
              {aiKey && aiProvider === 'groq' ? '사용 가능' : '설정 필요'}
            </span>
          </div>
          {(!aiKey || aiProvider !== 'groq') && (
            <div className="space-y-1">
              <p className="text-xs text-muted">위 <b>AI 요약</b> 섹션에서 Groq를 선택하고 키를 입력하면 자동으로 활성화됩니다.</p>
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-primary w-fit">
                Groq 키 발급 <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>

        {/* AssemblyAI */}
        <div className="rounded-xl bg-surface border border-divider px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-fg">AssemblyAI</p>
              <p className="text-xs text-muted">화자 분리 포함 · 100시간/월 무료</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${assemblyAiKey ? 'bg-primary/10 text-primary' : 'bg-divider text-muted'}`}>
              {assemblyAiKey ? '켜짐' : '꺼짐'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type={showAaiKey ? 'text' : 'password'}
              value={aaiKeyDraft}
              onChange={(e) => setAaiKeyDraft(e.target.value)}
              onBlur={() => { if (aaiKeyDraft !== assemblyAiKey) setAssemblyAiKey(aaiKeyDraft); }}
              placeholder="AssemblyAI API 키"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 bg-bg border border-divider rounded-full px-3 py-1.5 text-sm outline-none text-fg"
            />
            <button type="button" onClick={() => setShowAaiKey((v) => !v)} aria-label={showAaiKey ? '키 숨기기' : '키 보기'} className="w-9 h-9 grid place-items-center rounded-full border border-divider text-muted flex-none">
              {showAaiKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <a href="https://www.assemblyai.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-primary w-fit">
            무료 키 발급 <ExternalLink size={11} />
          </a>
        </div>
      </Section>

      {/* AI 요약 */}
      <Section title="AI 요약" Icon={Sparkles}>
        <p className="text-xs text-muted leading-relaxed">
          무료 LLM로 회의 요약·결정사항·할 일을 자동 정리합니다.
          API 키를 넣으면 켜지고, 비우면 기존 <b>규칙 기반 요약</b>으로 동작해요(키는 이 기기에만 저장).
          <br /><b>주의:</b> 켜면 전사 텍스트가 선택한 제공자 서버로 전송됩니다.
        </p>
        <div className="flex gap-2">
          {AI_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setAiProvider(p.id)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${aiProvider === p.id ? 'border-primary text-primary bg-primary/10' : 'border-divider text-muted'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onBlur={() => { if (keyDraft !== aiKey) setAiKey(keyDraft); }}
            placeholder={`${activeProvider.label} API 키`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-surface border border-divider rounded-full px-3 py-2 text-sm outline-none text-fg"
          />
          <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? '키 숨기기' : '키 보기'} className="w-10 h-10 grid place-items-center rounded-full border border-divider text-muted flex-none">
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs">
            <Sparkles size={14} className={aiKey ? 'text-primary' : 'text-muted'} />
            <span className={aiKey ? 'text-primary font-semibold' : 'text-muted'}>{aiKey ? 'AI 요약 켜짐' : 'AI 요약 꺼짐'}</span>
          </span>
          <a href={activeProvider.keyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-primary">
            무료 키 발급 <ExternalLink size={12} />
          </a>
        </div>
      </Section>

      {/* 클라우드 동기화 */}
      <Section title="클라우드 동기화" Icon={Cloud}>
        <p className="text-xs text-muted leading-relaxed">
          <b>내 Supabase 프로젝트</b>를 사용해 기기 간 동기화합니다 (무료·데이터 내 것).
          오디오는 크기 때문에 동기화에서 제외됩니다.
          <br /><b>주의:</b> 전사·메모가 내 Supabase 서버에 저장됩니다.
        </p>

        {/* SQL 설정 안내 */}
        <div className="rounded-xl bg-surface border border-divider px-3 py-2 space-y-1.5">
          <p className="text-xs font-semibold text-fg">1단계: 테이블 생성 (최초 1회)</p>
          <p className="text-xs text-muted">Supabase 대시보드 → SQL Editor에 아래 쿼리를 붙여넣고 실행하세요.</p>
          <div className="flex items-center justify-between gap-2">
            <code className="text-[10px] text-muted truncate flex-1">CREATE TABLE meetings ...</code>
            <button
              type="button"
              onClick={onCopySql}
              className="flex-none flex items-center gap-1 text-xs font-medium text-primary px-2 py-1 rounded-full bg-primary/10"
            >
              {sqlCopied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> SQL 복사</>}
            </button>
          </div>
        </div>

        {/* URL + Key 입력 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-fg">2단계: 연결 정보 입력</p>
          <input
            type="url"
            value={sbUrlDraft}
            onChange={(e) => setSbUrlDraft(e.target.value)}
            onBlur={onSbSave}
            placeholder="https://xxxx.supabase.co"
            autoComplete="off"
            className="w-full bg-surface border border-divider rounded-full px-3 py-2 text-sm outline-none text-fg"
          />
          <div className="flex items-center gap-2">
            <input
              type={showSbKey ? 'text' : 'password'}
              value={sbKeyDraft}
              onChange={(e) => setSbKeyDraft(e.target.value)}
              onBlur={onSbSave}
              placeholder="anon public key"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 bg-surface border border-divider rounded-full px-3 py-2 text-sm outline-none text-fg"
            />
            <button type="button" onClick={() => setShowSbKey((v) => !v)} aria-label={showSbKey ? '키 숨기기' : '키 보기'} className="w-10 h-10 grid place-items-center rounded-full border border-divider text-muted flex-none">
              {showSbKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* 연결 테스트 + 동기화 버튼 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onTestConn}
            disabled={syncBusy}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-divider text-fg text-sm font-medium py-2 disabled:opacity-50"
          >
            {syncBusy ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
            연결 테스트
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={syncBusy || !syncActive}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-primary text-white text-sm font-semibold py-2 disabled:opacity-50"
          >
            {syncBusy ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            지금 동기화
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Cloud size={13} className={syncActive ? 'text-primary' : 'text-muted'} />
          <span className={syncActive ? 'text-primary font-semibold' : 'text-muted'}>
            {syncActive ? '동기화 준비됨' : 'URL과 키를 입력하면 활성화'}
          </span>
          <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-primary font-medium">
            무료 계정 만들기 <ExternalLink size={11} />
          </a>
        </div>
      </Section>

          </div>
        )}
      </section>

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

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
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
