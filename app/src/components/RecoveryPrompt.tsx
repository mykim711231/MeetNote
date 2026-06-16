import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadDraft, clearDraft } from '@/lib/db';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { confirmDialog } from '@/stores/useConfirmStore';
import { toast } from '@/stores/useToastStore';
import { fmtDate, fmtDuration } from '@/lib/format';
import type { MeetingMeta } from '@/types';

// 앱 시작 시 중단된(크래시·강제종료·새로고침) 녹음 드래프트가 있으면 복구를 제안한다.
export default function RecoveryPrompt(): null {
  const navigate = useNavigate();
  const saveNew = useMeetingStore((s) => s.saveNew);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const draft = await loadDraft().catch(() => null);
      if (!draft) return;
      const hasContent = draft.meta.segments.length > 0 || !!draft.audio;
      if (!hasContent) { await clearDraft().catch(() => {}); return; }

      const ok = await confirmDialog({
        message: `이전에 중단된 녹음이 있습니다.\n(${fmtDuration(draft.meta.duration)}, 자막 ${draft.meta.segments.length}개)\n복구할까요?`,
        confirmLabel: '복구',
      });
      if (!ok) { await clearDraft().catch(() => {}); return; }

      const now = new Date().toISOString();
      const meta: MeetingMeta = {
        id: Date.now(),
        title: `복구된 회의 ${fmtDate(now)}`,
        date: now,
        duration: draft.meta.duration,
        segments: draft.meta.segments,
        folderId: null,
        hasAudio: !!draft.audio,
        audioType: draft.meta.audioType || 'audio/webm',
      };
      try {
        await saveNew(meta, draft.audio);
        await clearDraft().catch(() => {});
        toast('녹음을 복구했습니다.', 'success');
        navigate(`/m/${meta.id}`);
      } catch {
        toast('복구 저장에 실패했습니다 (저장 공간 부족).', 'error');
      }
    })();
  }, [navigate, saveNew]);

  return null;
}
