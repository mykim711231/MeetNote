// 네이티브(iOS) 파일 전사 플로우 — 동적 import로만 로드되어 웹 번들에 포함되지 않는다.
// IndexedDB 오디오 Blob → 임시 파일로 기록 → 네이티브 플러그인으로 온디바이스 전사 → Segment[].
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileTranscribe } from './fileTranscribe';
import type { Segment } from '@/types';

function extFor(audioType: string): string {
  if (audioType.includes('mp4') || audioType.includes('m4a') || audioType.includes('aac')) return 'm4a';
  if (audioType.includes('wav')) return 'wav';
  if (audioType.includes('ogg')) return 'ogg';
  if (audioType.includes('mpeg') || audioType.includes('mp3')) return 'mp3';
  if (audioType.includes('webm')) return 'webm';
  return 'm4a';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** 권한 요청 (음성 인식). 거부 시 false */
export async function ensureTranscribePermission(): Promise<boolean> {
  const r = await FileTranscribe.requestPermission();
  return !!r.granted;
}

/** 오디오 Blob을 온디바이스 전사 → Segment[] */
export async function transcribeAudioFile(blob: Blob, audioType: string, language: string): Promise<Segment[]> {
  const ext = extFor(audioType);
  const name = `meetnote-transcribe-${Date.now()}.${ext}`;
  const base64 = await blobToBase64(blob);
  const written = await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Cache });
  try {
    const res = await FileTranscribe.transcribe({ path: written.uri, language });
    return (res.segments ?? [])
      .filter((s) => s.text && s.text.trim())
      .map((s) => ({ who: '화자', text: s.text.trim(), ts: Math.max(0, Math.round(s.ts)) }));
  } finally {
    await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => {});
  }
}
