// Supabase REST API 기반 수동 동기화 (JS SDK 없음 — fetch만 사용)
// 사용자 자신의 Supabase 무료 프로젝트를 쓴다 → 비용 0, 데이터 내 것.
// 오디오 Blob은 크기 문제로 동기화하지 않는다(메타/전사/AI 요약만).
import type { MeetingMeta } from '@/types';

/** Supabase 기본 헤더 */
function headers(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: 'return=minimal',
  };
}

function baseUrl(projectUrl: string): string {
  return projectUrl.replace(/\/$/, '') + '/rest/v1/meetings';
}

async function checkErr(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error(`${label}: anon 키가 잘못됐거나 RLS 정책이 없습니다.`);
    if (res.status === 404) throw new Error(`${label}: meetings 테이블이 없습니다. Supabase SQL 에디터에서 테이블을 생성하세요.`);
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch { /* noop */ }
    throw new Error(`${label} 실패 (${res.status})${detail ? `: ${detail}` : ''}`);
  }
}

/** 클라우드에서 MeetingMeta 목록 가져오기 */
async function fetchRemote(url: string, key: string): Promise<MeetingMeta[]> {
  const res = await fetch(`${url}?select=id,data`, {
    headers: { ...headers(key), Prefer: 'return=representation' },
  });
  await checkErr(res, '클라우드 조회');
  const rows = (await res.json()) as Array<{ id: number; data: MeetingMeta }>;
  return rows.map((r) => r.data);
}

/** 로컬 회의록을 클라우드에 upsert (같은 id면 덮어씀) */
async function upsertBatch(url: string, key: string, metas: MeetingMeta[]): Promise<void> {
  if (metas.length === 0) return;
  const rows = metas.map((m) => ({ id: m.id, data: m }));
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(key), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  await checkErr(res, '클라우드 업로드');
}

export interface SyncResult {
  pushed: number;   // 로컬 → 클라우드 (upsert)
  pulled: number;   // 클라우드 → 로컬 (신규)
  merged: number;   // 클라우드 버전이 더 새서 로컬 덮어씀
}

/**
 * 양방향 수동 동기화.
 * - 로컬 전체를 클라우드에 upsert
 * - 클라우드에만 있거나 더 최신인 항목을 로컬에 반영
 *
 * @param onSaveMeta 로컬 DB 저장 콜백 (store update 포함)
 */
export async function syncMeetings(
  projectUrl: string,
  anonKey: string,
  localMetas: MeetingMeta[],
  onSaveMeta: (meta: MeetingMeta) => Promise<void>,
): Promise<SyncResult> {
  const url = baseUrl(projectUrl);

  // 1. push 로컬 전체 (upsert)
  await upsertBatch(url, anonKey, localMetas);
  const pushed = localMetas.length;

  // 2. pull 클라우드 → 로컬 미존재 / 더 최신 항목 저장
  const remote = await fetchRemote(url, anonKey);
  const localMap = new Map(localMetas.map((m) => [m.id, m]));
  let pulled = 0;
  let merged = 0;
  for (const rm of remote) {
    if (!rm || typeof rm.id !== 'number') continue;
    const lm = localMap.get(rm.id);
    if (!lm) {
      // 로컬에 없음 → 새로 저장
      await onSaveMeta(rm);
      pulled++;
    } else if (rm.ai && !lm.ai) {
      // 클라우드에 AI 요약 있지만 로컬엔 없음 → 병합
      await onSaveMeta({ ...lm, ai: rm.ai });
      merged++;
    }
  }

  return { pushed, pulled, merged };
}

/** 연결 테스트 (테이블 존재 여부만 확인) */
export async function testConnection(projectUrl: string, anonKey: string): Promise<void> {
  const res = await fetch(`${baseUrl(projectUrl)}?limit=1`, {
    headers: { ...headers(anonKey), Prefer: 'return=representation' },
  });
  await checkErr(res, '연결 테스트');
}

/** Supabase SQL 에디터에 붙여넣을 테이블 생성 쿼리 */
export const SETUP_SQL = `-- MeetNote 동기화 테이블 (한 번만 실행)
CREATE TABLE IF NOT EXISTS public.meetings (
  id BIGINT PRIMARY KEY,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.meetings
  FOR ALL USING (true) WITH CHECK (true);`;
