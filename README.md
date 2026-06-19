# MeetNote 회의록

> **기기 우선, 클라우드 옵션** — 기본은 서버·계정·비용 없이 완전 로컬로 동작하고,  
> API 키를 등록하면 AI 요약·공유 링크·기기 간 동기화·고품질 전사가 추가됩니다.  
> 모든 온라인 기능은 **옵트인**이고 **무료 티어**만 사용합니다.

**라이브:** https://mykim711231.github.io/MeetNote/

---

## ✨ 한눈에

| | 기능 | 기본(무료·로컬) | 옵트인(무료·클라우드) |
|---|---|---|---|
| 🎙️ | **녹음** | 마이크·시스템·믹스, 일시정지, 음량 미터 | — |
| 📝 | **실시간 자막** | Web Speech API (ko/en/ja/zh) | — |
| 🤖 | **자동 전사** | 온디바이스 Whisper (브라우저 내) | Groq Whisper (빠름) · AssemblyAI 화자 분리 |
| ✨ | **요약·할 일** | 규칙 기반 추출 (오프라인) | AI 요약 — Gemini Flash / Groq(Llama) |
| ▶️ | **재생** | 자막 클릭 점프, 배속, 이어듣기 | — |
| 🔗 | **공유** | 복사·Web Share·인쇄 | GitHub Gist 공유 링크 (익명·무료) |
| ☁️ | **동기화** | IndexedDB 로컬 저장 | Supabase 기기 간 동기화 (내 프로젝트) |
| 🗂️ | **관리** | 폴더·검색·정렬·핀·메모·통계 | — |
| 📤 | **내보내기** | TXT·MD·JSON·오디오·합본 | AI 요약 포함 MD·인쇄 |
| 💾 | **안전** | 크래시 복구·삭제 실행취소·백업/복원 | — |

> **프라이버시 원칙:** 키를 등록하지 않으면 데이터는 기기 밖으로 나가지 않습니다.  
> 클라우드 기능을 켜면 해당 내용(전사·메모)이 선택한 서비스 서버로 전송됩니다.

---

## 📋 기능 상세

### 녹음
- **소스 선택**: 마이크 / 시스템 소리(`getDisplayMedia`) / 둘 다(AudioContext 믹스)
- 일시정지·재개, 실시간 음량 레벨 미터
- **발언자** 라벨 지정·추가, 발언자별 고정 색상
- **자막 언어** 선택(ko/en/ja/zh)
- **Wake Lock**: 녹음 중 화면 꺼짐 방지
- **크래시 복구**: 오디오 청크를 즉시 IndexedDB에 적재 → 다음 실행에서 복구 제안
- **이탈 경고**: 녹음 중 탭 닫기/새로고침 시 확인

### 자동 전사 (파일 → 텍스트)

저장된 오디오를 전사할 수 있는 세 가지 방식:

| 방식 | 조건 | 특징 |
|---|---|---|
| **온디바이스 Whisper** | 없음 (기본) | 브라우저 내부 처리·오프라인·첫 사용 시 모델 다운로드 |
| **Groq Whisper** | Groq API 키 (AI 요약 섹션) | 초고속·높은 정확도·키 재활용 |
| **AssemblyAI 화자 분리** | AssemblyAI API 키 | "발언자 A / 발언자 B" 자동 분리·100시간/월 무료 |

### AI 요약 (옵트인)

회의 전사를 무료 LLM으로 분석해 네 가지를 자동 생성합니다:

- **TL;DR** — 회의 전체를 한 문장으로
- **핵심 논의** — 3~6개 주요 포인트
- **결정 사항** — 확정된 내용
- **액션아이템** — 담당자 포함 할 일 목록

지원 제공자:

| 제공자 | 모델 | 무료 한도 |
|---|---|---|
| **Google Gemini** | gemini-2.0-flash | 일일 한도 내 무료 |
| **Groq** | llama-3.3-70b-versatile | 분당 요청 한도 무료 |

AI 결과는 회의록에 저장(캐시)되고, MD 내보내기·인쇄에도 자동 반영됩니다.  
키가 없으면 기존 규칙 기반 요약이 그대로 동작합니다.

### 공유 링크 (옵트인)

회의록 → "링크" 버튼 → **GitHub Secret Gist**에 Markdown으로 업로드 → URL 클립보드 복사.  
Secret Gist는 URL을 아는 사람만 접근 가능합니다. 계정·로그인 불필요.

### 클라우드 동기화 (옵트인)

**사용자 자신의 Supabase 무료 프로젝트**를 사용해 기기 간 회의록을 동기화합니다.  
데이터는 내 Supabase 프로젝트에만 저장되며, 오디오는 크기 때문에 제외됩니다.

설정 방법:
1. [supabase.com](https://supabase.com)에서 무료 프로젝트 생성
2. 설정 → 클라우드 동기화 → **SQL 복사** → Supabase SQL Editor에서 실행(최초 1회)
3. Project URL + anon key 입력 → 연결 테스트
4. **지금 동기화** 버튼으로 수동 동기화 (push 전체 + pull 신규)

### 회의록 상세
- **오디오 플레이어**: 재생/일시정지, 탐색 바, 배속(0.75×~2×), 키보드 단축키(Space·←·→), 이어듣기
- **자막 동기화**: 현재 재생 구간 하이라이트, 자막 클릭 시 점프
- **전사 편집**: 발언 내용 수정·발언자 변경·삭제
- **발언 비중**: 발언자별 발언량 막대
- **탭**: 전문·요약(AI 포함)·할 일·메모
- **고정(핀)·폴더 지정·제목 편집·삭제(실행취소 6초)**
- **MediaSession**: 잠금화면/데스크톱 미디어 컨트롤

### 기록(목록)
- 제목·내용 **검색** + 하이라이트
- **정렬**: 최신순 / 오래된순 / 긴 길이순
- **폴더 필터**, **고정 우선** 노출
- **월별 달력 보기**
- **통계**: 총 회의 수·총 녹음 시간·이번 주 건수

### 내보내기 / 백업
- 단건: **TXT · Markdown(AI 요약 포함) · JSON · 오디오 파일**
- **복사**(클립보드) · **공유**(Web Share) · **공유 링크**(GitHub Gist) · **인쇄**(PDF)
- 전체: **합본 Markdown**, **백업 JSON**(오디오 포함/텍스트만), **복원**

### 설정

| 섹션 | 내용 |
|---|---|
| **저장소** | 사용량·영속 저장(`storage.persist`) |
| **녹음** | 노이즈 감소 토글 |
| **전사 품질** | Groq Whisper 상태 확인 · AssemblyAI 키 입력 |
| **AI 요약** | 제공자 선택(Gemini/Groq) · API 키 입력 |
| **클라우드 동기화** | Supabase URL·anon key · 연결 테스트 · 동기화 |
| **폴더** | 추가·삭제 |
| **백업·복원** | 전체/텍스트만 백업 · 복원 · 합본 MD |
| **정보** | 버전 |
| **데이터 초기화** | 위험 구역 |

---

## 🚀 사용법 (빠른 시작)

1. 브라우저(권장: **Chrome / Edge**)에서 https://mykim711231.github.io/MeetNote/ 접속
2. 설정 탭 → **"홈 화면에 앱 설치"** 로 설치(선택)
3. **녹음 탭**에서 제목·발언자·소스·언어를 정하고 빨간 버튼으로 녹음 시작
4. 말하면 자막이 실시간 생성 → 정지(■) 후 자동 저장
5. **기록 탭**에서 회의록을 열어 재생·요약·할 일·편집·내보내기

> ⚠️ 녹음(마이크)·PWA 설치는 **HTTPS 또는 localhost**에서만 동작합니다.  
> 중요한 회의록은 설정 → 백업으로 주기적으로 내보내세요.

---

## 🌐 브라우저 지원

| 기능 | Chrome/Edge | Safari | Firefox |
|---|---|---|---|
| 녹음(MediaRecorder) | ✅ | ✅ | ✅ |
| 실시간 자막(Web Speech) | ✅ | 제한적 | ❌ |
| 온디바이스 전사(Whisper/WebGPU) | ✅ | 부분 | 부분 |
| 시스템 소리(getDisplayMedia) | ✅(데스크톱) | 제한적 | 제한적 |
| PWA 설치 | ✅ | ✅(수동) | 부분 |

자막이 핵심이면 **Chrome·Edge** 권장.

---

## 🛠️ 기술 스택

| 레이어 | 기술 |
|---|---|
| UI | React 18 + TypeScript 5 (strict) |
| 빌드 | Vite 5 |
| PWA | vite-plugin-pwa + Workbox 7 |
| 스타일 | Tailwind CSS 3 + CSS 토큰 다크모드 |
| 상태 | Zustand |
| 저장 | IndexedDB (idb-keyval) + localStorage |
| 아이콘 | lucide-react |
| 라우팅 | React Router (HashRouter — GitHub Pages 호환) |

**브라우저 API:** `MediaRecorder` · `getUserMedia` · `getDisplayMedia` · `Web Speech API` · `AudioContext` · `Wake Lock` · `MediaSession` · `Web Share` · `storage.persist`

**외부 API (옵트인, 사용자 키):**

| 서비스 | 용도 | 무료 한도 |
|---|---|---|
| Google Gemini API | AI 요약 | 일일 한도 무료 |
| Groq API | AI 요약 + 고속 전사(Whisper) | 분당 한도 무료 |
| AssemblyAI | 화자 분리 전사 | 100시간/월 |
| GitHub Gist API | 공유 링크 | 무제한 (익명) |
| Supabase REST | 기기 간 동기화 | 500MB DB 무료 |

---

## 📁 프로젝트 구조

```
MeetNote/
├── app/
│   ├── src/
│   │   ├── hooks/            # useRecorder, useWakeLock
│   │   ├── lib/
│   │   │   ├── db.ts                # IndexedDB 저장 계층
│   │   │   ├── stt.ts / sttNative.ts# Web Speech / Capacitor STT
│   │   │   ├── summarize.ts         # 규칙 기반 요약·할 일 추출 (오프라인)
│   │   │   ├── aiSummarize.ts       # AI 요약 — Gemini / Groq
│   │   │   ├── transcribeWhisper.ts # 온디바이스 Whisper 전사
│   │   │   ├── transcribeCloud.ts   # 클라우드 전사 — Groq Whisper / AssemblyAI
│   │   │   ├── transcribeNative.ts  # iOS SFSpeech 전사
│   │   │   ├── gistShare.ts         # GitHub Gist 공유 링크
│   │   │   ├── cloudSync.ts         # Supabase 기기 간 동기화
│   │   │   ├── export.ts            # 내보내기·백업/복원
│   │   │   └── …                   # format, speakers, playpos, …
│   │   ├── stores/           # Zustand (meeting, pref, toast, confirm, update)
│   │   ├── components/       # Provider·TabBar·TopBar·Toast·Onboarding 등
│   │   ├── routes/           # RecordView · LibraryView · MeetingDetail · SettingsView
│   │   ├── workers/          # whisper.worker.ts
│   │   └── types.ts
│   ├── public/icons/
│   └── vite.config.ts
├── .github/workflows/deploy.yml
├── Docs/
└── *.ps1                     # dev / deploy 스크립트
```

---

## 💻 개발

```powershell
cd app
npm install
npm run dev        # http://localhost:5173/
npm run typecheck
npm run build
```

---

## 🚢 배포

`main` 브랜치 push → GitHub Actions → GitHub Pages 자동 배포.

```powershell
.\deploy.ps1 -BuildFirst      # 타입체크·빌드 검증 후 커밋·푸시
```

배포 URL: https://mykim711231.github.io/MeetNote/

---

## 🔒 프라이버시

| 조건 | 데이터 처리 |
|---|---|
| 클라우드 기능 미설정(기본) | 모든 데이터가 기기 IndexedDB/localStorage에만 저장. 외부 전송 없음 |
| AI 요약 사용 | 전사 텍스트가 Gemini 또는 Groq 서버로 전송됨 |
| 공유 링크 사용 | 회의록 텍스트가 GitHub Gist(공개 URL)에 업로드됨 |
| 클라우드 동기화 사용 | 전사·메모가 사용자 본인의 Supabase 프로젝트에 저장됨 |
| Groq/AssemblyAI 전사 | 오디오 파일이 해당 서버로 전송됨 |

- 실시간 자막은 브라우저 내장 음성 인식 사용(브라우저별로 처리 위치 다를 수 있음)
- 모든 API 키는 기기 localStorage에만 저장되며 외부로 전송되지 않습니다
- 기기 변경·초기화 전 **백업 내보내기**를 권장합니다

---

## 📱 플랫폼 / 하이브리드 (Capacitor)

웹(PWA)을 기본으로 하되, **iOS는 Capacitor로 네이티브 앱**으로 감싸 자막을 네이티브 음성인식(SFSpeechRecognizer, 온디바이스)으로 처리합니다.  
iOS WKWebView에는 Web Speech API가 없고, 원거리 자막에 네이티브 STT가 유리합니다.

- 코드 분기: `Capacitor.isNativePlatform()` — 웹=Web Speech / 네이티브=플러그인, 웹 동작 불변
- 빌드: `npm run cap:ios` (Mac 필요)
- 상세: **[iOS 빌드 가이드](Docs/iOS_빌드_가이드.md)**

---

## 📄 문서

- [사용설명서](Docs/사용설명서.md)
- [iOS 빌드 가이드](Docs/iOS_빌드_가이드.md)
- [회의록 기술 스택 조사](Docs/회의록_기술스택_조사.md)
