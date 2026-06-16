// MeetNote 데이터 모델

/** 전사 세그먼트 1개 */
export interface Segment {
  who: string;      // 발언자 라벨
  text: string;     // 전사 텍스트
  ts: number;       // 녹음 시작 기준 경과 시간(ms) — 오디오 타임라인과 정렬
}

/** 회의록 메타데이터 (오디오 Blob 제외 — 목록/검색/상세 텍스트용) */
export interface MeetingMeta {
  id: number;            // Date.now()
  title: string;
  date: string;          // ISO 8601
  duration: number;      // 녹음 길이(ms)
  segments: Segment[];
  folderId: string | null;
  hasAudio: boolean;     // 오디오 Blob 존재 여부
  audioType: string;     // 예: "audio/webm"
  pinned?: boolean;      // 상단 고정 여부
}

/** 폴더 1개 (1단계, 중첩 없음) */
export interface Folder {
  id: string;            // "f" + Date.now()
  name: string;
}

/** 백업 파일 포맷 */
export interface BackupFile {
  app: 'MeetNote';
  version: 1;
  exportedAt: string;
  folders: Folder[];
  meetings: Array<{
    meta: MeetingMeta;
    audioBase64: string | null;  // data: 제외한 순수 base64
  }>;
}
