// MeetNote 데이터 모델

/** 전사 세그먼트 1개 */
export interface Segment {
  who: string;      // 발언자 라벨
  text: string;     // 전사 텍스트
  ts: number;       // 녹음 시작 기준 경과 시간(ms) — 오디오 타임라인과 정렬
}

/** AI 요약 결과 (무료 LLM API · 옵트인 · 회의록에 캐시) */
export interface AiSummary {
  tldr: string;                              // 한 줄 요약
  keyPoints: string[];                       // 핵심 논의
  decisions: string[];                       // 결정 사항
  todos: Array<{ text: string; who?: string }>; // 액션아이템
  model: string;                             // 생성 모델 (예: gemini-2.0-flash)
  at: string;                                // 생성 시각 ISO 8601
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
  note?: string;         // 자유 메모
  ai?: AiSummary;        // AI 생성 요약 (있을 때만 — 옵트인)
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
