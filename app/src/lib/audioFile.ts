// 오디오 파일 가져오기 유틸

/** 오디오 Blob의 길이(ms)를 메타데이터로 추정 (실패 시 0) */
export function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    let settled = false;
    const done = (ms: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      const d = a.duration;
      done(Number.isFinite(d) && d > 0 ? Math.round(d * 1000) : 0);
    };
    a.onerror = () => done(0);
    // 일부 포맷이 metadata를 안 주는 경우 대비 타임아웃
    setTimeout(() => done(0), 8000);
    a.src = url;
  });
}

const EXT_TYPE: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac',
  wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  webm: 'audio/webm', flac: 'audio/flac', amr: 'audio/amr', '3gp': 'audio/3gpp',
};

/** file.type이 비어있으면 확장자로 MIME 추정 */
export function guessAudioType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TYPE[ext] ?? 'audio/mpeg';
}

/** 확장자 제거한 파일명 → 제목 */
export function fileTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').trim() || '가져온 회의';
}
