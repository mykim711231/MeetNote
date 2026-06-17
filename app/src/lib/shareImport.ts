// 네이티브(iOS/Android) "공유/열기로 가져오기" — 음성 메모 등에서 공유 → MeetNote
// 동적 import로만 로드되어 웹 번들에 포함되지 않는다.
// iOS: Info.plist의 CFBundleDocumentTypes(public.audio)로 공유 시트에 MeetNote가 뜨고,
//      파일을 열면 appUrlOpen 이벤트로 file:// URL이 전달된다.
import { App } from '@capacitor/app';
import { Filesystem } from '@capacitor/filesystem';
import { getAudioDuration, guessAudioType, fileTitle } from './audioFile';
import { requestPersist } from './db';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { toast } from '@/stores/useToastStore';
import type { MeetingMeta } from '@/types';

const AUDIO_EXT = /\.(m4a|mp3|wav|aac|ogg|opus|webm|flac|amr|3gp|3gpp|mp4|caf)$/i;

function base64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function importFromUrl(url: string): Promise<void> {
  let decoded = url;
  try { decoded = decodeURIComponent(url); } catch { /* keep raw */ }
  const name = (decoded.split('?')[0].split('/').pop() || 'recording.m4a').trim();
  if (!AUDIO_EXT.test(name)) return; // 오디오 파일만 처리

  const read = await Filesystem.readFile({ path: url });
  const data = typeof read.data === 'string' ? read.data : '';
  if (!data) return;

  const nameFile = new File([], name);
  const type = guessAudioType(nameFile); // 확장자로 MIME 추정
  const blob = base64ToBlob(data, type);
  const file = new File([blob], name, { type });

  await requestPersist().catch(() => false);
  const duration = await getAudioDuration(blob);
  const meta: MeetingMeta = {
    id: Date.now(),
    title: fileTitle(file),
    date: new Date().toISOString(),
    duration,
    segments: [],
    folderId: null,
    hasAudio: true,
    audioType: type,
  };
  await useMeetingStore.getState().saveNew(meta, blob);
  toast('음성 파일을 가져왔어요.', 'success');
  window.location.hash = `#/m/${meta.id}`;
}

let inited = false;

/** 앱 시작 시 1회 호출 (네이티브에서만). 공유/열기로 들어온 오디오를 회의록으로 가져온다. */
export async function initShareImport(): Promise<void> {
  if (inited) return;
  inited = true;
  // 콜드 스타트(파일을 열어 앱이 실행된 경우)
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) await importFromUrl(launch.url);
  } catch { /* noop */ }
  // 실행 중 공유/열기
  await App.addListener('appUrlOpen', (e: { url: string }) => {
    if (e?.url) void importFromUrl(e.url).catch(() => toast('가져오기에 실패했어요.', 'error'));
  });
}
