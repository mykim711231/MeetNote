// IndexedDB 저장 계층 (idb-keyval 커스텀 스토어)
// 키 구조:
//   meta:<id>   → MeetingMeta (오디오 제외)
//   audio:<id>  → Blob (재생 시에만 로드)
//   index       → number[] (회의 id 목록, 최신순)

import { get, set, del, keys, createStore } from 'idb-keyval';
import type { MeetingMeta } from '@/types';

const store = createStore('meetnote-db', 'kv');

const metaKey = (id: number) => `meta:${id}`;
const audioKey = (id: number) => `audio:${id}`;
const INDEX_KEY = 'index';

async function getIndex(): Promise<number[]> {
  const idx = await get<number[]>(INDEX_KEY, store);
  return Array.isArray(idx) ? idx : [];
}

async function setIndex(ids: number[]): Promise<void> {
  await set(INDEX_KEY, ids, store);
}

/** 회의록 메타 목록 (최신순) */
export async function listMeetings(): Promise<MeetingMeta[]> {
  const ids = await getIndex();
  const metas = await Promise.all(ids.map((id) => get<MeetingMeta>(metaKey(id), store)));
  return metas.filter((m): m is MeetingMeta => !!m);
}

/** 단일 회의록 메타 */
export async function getMeeting(id: number): Promise<MeetingMeta | undefined> {
  return get<MeetingMeta>(metaKey(id), store);
}

/** 오디오 Blob (재생 시) */
export async function getAudio(id: number): Promise<Blob | undefined> {
  return get<Blob>(audioKey(id), store);
}

/** 신규 저장 (메타 + 오디오). 인덱스 맨 앞에 추가.
 *  실패(저장공간 부족 등) 시 부분 기록을 롤백해 dangling 레코드를 남기지 않는다. */
export async function saveMeeting(meta: MeetingMeta, audio: Blob | null): Promise<void> {
  try {
    if (audio) await set(audioKey(meta.id), audio, store); // 큰 오디오 먼저 — 실패해도 meta/index 미오염
    await set(metaKey(meta.id), meta, store);
    const ids = await getIndex();
    if (!ids.includes(meta.id)) {
      await setIndex([meta.id, ...ids]);
    }
  } catch (e) {
    // 롤백: 흔적 제거 후 호출자에게 오류 전파
    await del(audioKey(meta.id), store).catch(() => {});
    await del(metaKey(meta.id), store).catch(() => {});
    throw e;
  }
}

/** 메타만 갱신 (제목 수정, 폴더 이동, 세그먼트 편집 등) */
export async function updateMeta(meta: MeetingMeta): Promise<void> {
  await set(metaKey(meta.id), meta, store);
}

/** 회의록 삭제 (메타 + 오디오 + 인덱스) */
export async function deleteMeeting(id: number): Promise<void> {
  await del(metaKey(id), store);
  await del(audioKey(id), store);
  const ids = await getIndex();
  await setIndex(ids.filter((x) => x !== id));
}

/** 저장소 사용량 추정 (지원 브라우저만) */
export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return { usage: usage ?? 0, quota: quota ?? 0 };
}

/** 영속 저장 요청 (브라우저 eviction 방지) */
export async function requestPersist(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function isPersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  return navigator.storage.persisted();
}

/** 디버그/백업용: 전체 키 수 */
export async function allKeys(): Promise<IDBValidKey[]> {
  return keys(store);
}

/** 인덱스 정합성 복구: 메타 없는 id 제거 + 인덱스에 빠진 고아 메타 편입.
 *  중단된 저장/크래시로 생긴 dangling을 앱 시작 시 한 번 정리한다. */
export async function reconcileIndex(): Promise<void> {
  const allK = await keys(store);
  const metaIds = allK
    .filter((k): k is string => typeof k === 'string' && k.startsWith('meta:'))
    .map((k) => Number(k.slice(5)))
    .filter((n) => Number.isFinite(n));
  const idx = await getIndex();
  const metaSet = new Set(metaIds);
  const valid = idx.filter((id) => metaSet.has(id));
  const known = new Set(valid);
  const orphans = metaIds.filter((id) => !known.has(id)).sort((a, b) => b - a);
  if (orphans.length > 0 || valid.length !== idx.length) {
    await setIndex([...valid, ...orphans]);
  }
}
