// 내보내기 · 백업/복원 (완전 로컬)
import type { MeetingMeta, Folder, BackupFile } from '@/types';
import { fmtTime, fmtDate, fmtDuration } from './format';
import { summarize, extractTodos } from './summarize';
import { listMeetings, getAudio, saveMeeting } from './db';

/** Blob 다운로드 트리거 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 일부 브라우저가 클릭 후 즉시 revoke하면 다운로드 실패 → 지연
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 파일명에 안전하지 않은 문자 제거 */
export function safeFilename(name: string): string {
  return (name || '회의록').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 80) || '회의록';
}

/** 일반 텍스트(.txt) */
export function toPlainText(m: MeetingMeta): string {
  const lines: string[] = [];
  lines.push(m.title || '제목 없음');
  lines.push(`${fmtDate(m.date)} · ${fmtDuration(m.duration)}`);
  lines.push('');
  for (const s of m.segments) {
    lines.push(`[${fmtTime(s.ts)}] ${s.who}: ${s.text}`);
  }
  return lines.join('\n');
}

/** 마크다운 구조 문자 중화 (제목·발언자 같은 짧은 필드의 인젝션 방지) */
function mdInline(s: string): string {
  return (s || '').replace(/\r?\n/g, ' ').replace(/([#*_`[\]<>])/g, '\\$1');
}

/** 마크다운(.md) — 요약·할일 포함 */
export function toMarkdown(m: MeetingMeta): string {
  const out: string[] = [];
  out.push(`# ${mdInline(m.title) || '제목 없음'}`);
  out.push('');
  out.push(`- 일시: ${fmtDate(m.date)}`);
  out.push(`- 길이: ${fmtDuration(m.duration)}`);
  out.push('');

  const summary = summarize(m.segments);
  if (summary.length) {
    out.push('## 요약');
    for (const s of summary) out.push(`- ${s}`);
    out.push('');
  }

  const todos = extractTodos(m.segments);
  if (todos.length) {
    out.push('## 할 일');
    for (const t of todos) out.push(`- [ ] ${t.text} _(${mdInline(t.who)})_`);
    out.push('');
  }

  out.push('## 전문');
  for (const s of m.segments) {
    out.push(`**[${fmtTime(s.ts)}] ${mdInline(s.who)}:** ${s.text}`);
    out.push('');
  }
  return out.join('\n');
}

// ── base64 변환 (대용량 Blob 안전 처리: 청크 단위) ──
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** 전체 백업 파일 생성 (메타 + 오디오 base64)
 *  순차 처리로 한 번에 오디오 1개분만 메모리에 올려 대용량에서 OOM을 방지한다.
 *  includeAudio=false면 텍스트만 백업(가볍고 빠름) — 복원본은 오디오 없는 회의록이 된다. */
export async function buildBackup(folders: Folder[], includeAudio = true): Promise<BackupFile> {
  const metas = await listMeetings();
  const meetings: BackupFile['meetings'] = [];
  for (const meta of metas) {
    if (!includeAudio) {
      meetings.push({ meta: { ...meta, hasAudio: false }, audioBase64: null });
      continue;
    }
    const audio = meta.hasAudio ? await getAudio(meta.id) : undefined;
    meetings.push({ meta, audioBase64: audio ? await blobToBase64(audio) : null });
  }
  return {
    app: 'MeetNote',
    version: 1,
    exportedAt: new Date().toISOString(),
    folders,
    meetings,
  };
}

/** 백업 복원 — 기존 데이터에 병합(같은 id는 덮어씀). 반환: 복원 건수 */
export async function restoreBackup(data: BackupFile): Promise<number> {
  if (data?.app !== 'MeetNote' || data.version !== 1 || !Array.isArray(data.meetings)) {
    throw new Error('유효한 MeetNote 백업 파일이 아닙니다.');
  }
  let count = 0;
  for (const item of data.meetings) {
    // 손상된 한 항목이 전체 복원을 중단시키지 않도록 항목별로 격리
    try {
      if (!item?.meta || typeof item.meta.id !== 'number') continue;
      if (!Array.isArray(item.meta.segments)) item.meta.segments = [];
      const audio = item.audioBase64
        ? base64ToBlob(item.audioBase64, item.meta.audioType || 'audio/webm')
        : null;
      await saveMeeting(item.meta, audio);
      count++;
    } catch {
      // 이 항목 건너뛰고 계속
    }
  }
  return count;
}
