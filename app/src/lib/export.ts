// 내보내기 · 백업/복원 (완전 로컬)
import type { MeetingMeta, Folder, BackupFile } from '@/types';
import { fmtTime, fmtDate, fmtDuration, esc } from './format';
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

/** 클립보드 복사 (실패 시 execCommand 폴백) */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Web Share 지원 여부 */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** 텍스트 공유 (공유 시트). 취소/미지원 시 false */
export async function shareText(title: string, text: string): Promise<boolean> {
  if (!canShare()) return false;
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}

/** 인쇄용 창을 열어 출력(사용자가 PDF로 저장 가능) */
export function printMeeting(m: MeetingMeta): void {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  const noteHtml = m.note && m.note.trim()
    ? `<h2>메모</h2><p>${esc(m.note.trim()).replace(/\n/g, '<br>')}</p>`
    : '';
  let summaryHtml = '';
  let todoHtml = '';
  if (m.ai) {
    const parts: string[] = ['<h2>요약 (AI)</h2>'];
    if (m.ai.tldr) parts.push(`<p>${esc(m.ai.tldr)}</p>`);
    if (m.ai.keyPoints.length) parts.push(`<h3>핵심 논의</h3><ul>${m.ai.keyPoints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`);
    if (m.ai.decisions.length) parts.push(`<h3>결정 사항</h3><ul>${m.ai.decisions.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`);
    summaryHtml = parts.join('');
    todoHtml = m.ai.todos.length
      ? `<h2>할 일</h2><ul>${m.ai.todos.map((t) => `<li>${esc(t.text)}${t.who ? ` (${esc(t.who)})` : ''}</li>`).join('')}</ul>`
      : '';
  } else {
    const summary = summarize(m.segments);
    const todos = extractTodos(m.segments);
    summaryHtml = summary.length
      ? `<h2>요약</h2><ul>${summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
      : '';
    todoHtml = todos.length
      ? `<h2>할 일</h2><ul>${todos.map((t) => `<li>${esc(t.text)} (${esc(t.who)})</li>`).join('')}</ul>`
      : '';
  }
  const rows = m.segments
    .map((s) => `<p><b>[${fmtTime(s.ts)}] ${esc(s.who)}:</b> ${esc(s.text)}</p>`)
    .join('');
  try {
    w.document.write(
      `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(m.title || '회의록')}</title>` +
      `<style>body{font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif;padding:28px;line-height:1.65;color:#1a1a1a;max-width:760px;margin:auto}` +
      `h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:20px 0 6px}h3{font-size:14px;margin:12px 0 4px;color:#444}.meta{color:#666;font-size:13px;margin-bottom:16px}p{margin:5px 0}ul{margin:6px 0 0 18px}@media print{body{padding:0}}</style>` +
      `</head><body><h1>${esc(m.title || '회의록')}</h1>` +
      `<div class="meta">${fmtDate(m.date)} · ${fmtDuration(m.duration)}</div>` +
      noteHtml + summaryHtml + todoHtml + `<h2>전문</h2>${rows}</body></html>`
    );
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* noop */ } }, 250);
  } catch { /* 팝업이 닫혔거나 Document 쓰기 불가 */ }
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

  if (m.note && m.note.trim()) {
    out.push('## 메모');
    out.push(m.note.trim().split('\n').map(mdInline).join('\n'));
    out.push('');
  }

  if (m.ai) {
    // AI 요약이 있으면 우선 사용 (tldr·핵심·결정·액션아이템)
    out.push('## 요약 (AI)');
    if (m.ai.tldr) { out.push(mdInline(m.ai.tldr)); out.push(''); }
    if (m.ai.keyPoints.length) {
      out.push('### 핵심 논의');
      for (const p of m.ai.keyPoints) out.push(`- ${mdInline(p)}`);
      out.push('');
    }
    if (m.ai.decisions.length) {
      out.push('### 결정 사항');
      for (const d of m.ai.decisions) out.push(`- ${mdInline(d)}`);
      out.push('');
    }
    if (m.ai.todos.length) {
      out.push('## 할 일');
      for (const t of m.ai.todos) out.push(`- [ ] ${mdInline(t.text)}${t.who ? ` _(${mdInline(t.who)})_` : ''}`);
      out.push('');
    }
  } else {
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
  }

  out.push('## 전문');
  for (const s of m.segments) {
    out.push(`**[${fmtTime(s.ts)}] ${mdInline(s.who)}:** ${mdInline(s.text)}`);
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

/** 모든 회의록을 하나의 마크다운으로 합본 */
export async function buildCombinedMarkdown(): Promise<string> {
  const metas = await listMeetings();
  if (metas.length === 0) return '# MeetNote 회의록\n\n저장된 회의록이 없습니다.\n';
  return `# MeetNote 회의록 (${metas.length}건)\n\n` + metas.map((m) => toMarkdown(m)).join('\n\n---\n\n') + '\n';
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
