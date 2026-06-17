# MeetNote 회의록

> 서버·계정·비용 없이 **기기에서만 동작하는 개인용 회의록 녹음 PWA**.
> 녹음 · 실시간 자막 · 요약 · 할 일 · 재생 · 백업을 모두 **오프라인·로컬**에서 처리합니다.

**라이브:** https://mykim711231.github.io/MeetNote/

---

## ✨ 한눈에

- 🎙️ **녹음** — 마이크 / 시스템(탭) 소리 / 둘 다(믹스), 일시정지·재개, 음량 미터
- 📝 **실시간 자막** — Web Speech API (한국어·영어·일본어·중국어), 발언자별 타임스탬프
- ▶️ **재생** — 자막 클릭 → 해당 구간 점프, 배속(0.75~2×), 이어듣기, 잠금화면 컨트롤
- ✂️ **정리** — 규칙 기반 요약·할 일 자동 추출, 전사 편집, 발언자 색상·발언 비중
- 🗂️ **관리** — 폴더·검색(하이라이트)·정렬·고정(핀)·메모·통계
- 📤 **내보내기** — TXT·Markdown·JSON·오디오·복사·공유·인쇄(PDF)·전체 합본
- 💾 **안전** — IndexedDB 저장, 영속 저장, 크래시 복구, 삭제 실행취소, 백업/복원
- 📱 **PWA** — 오프라인 동작, 홈 화면 설치, 자동 업데이트

> **프라이버시:** 모든 데이터는 사용자 기기 안에만 저장됩니다. 서버 전송·계정·추적이 없습니다.

---

## 📋 기능 상세

### 녹음
- **소스 선택**: 마이크 / 시스템 소리(`getDisplayMedia`, 온라인 회의 캡처) / 둘 다(AudioContext 믹스)
- 일시정지·재개, 실시간 음량 레벨 미터
- **발언자** 라벨 지정·추가, 발언자별 고정 색상
- **자막 언어** 선택(ko/en/ja/zh) — 시스템 소리 단독 시 자막 미생성
- **Wake Lock**: 녹음 중 화면 꺼짐 방지
- **크래시 복구**: 오디오 청크를 즉시 IndexedDB에 적재 → 비정상 종료 후 다음 실행에서 복구 제안
- **이탈 경고**: 녹음 중 탭 닫기/새로고침 시 확인

### 회의록 상세
- **오디오 플레이어**: 재생/일시정지, 탐색 바, 배속, 키보드 단축키(Space·←·→), 이어듣기(위치 기억)
- **자막 동기화**: 현재 재생 구간 하이라이트, 자막 클릭 시 점프
- **전사 편집**: 발언 내용 수정·발언자 변경·삭제
- **요약 / 할 일**: 규칙 기반 추출(LLM·서버 불필요)
- **메모 탭**: 회의별 자유 메모(자동 저장)
- **발언 비중**: 발언자별 발언량 막대
- **고정(핀)·폴더 지정·제목 편집·삭제(실행취소 6초)**
- **MediaSession**: 잠금화면/데스크톱 미디어 컨트롤

### 기록(목록)
- 제목·내용 **검색** + 일치 부분 하이라이트
- **정렬**: 최신순 / 오래된순 / 긴 길이순
- **폴더 필터**, **고정 우선** 노출
- **통계**: 총 회의 수 · 총 녹음 시간 · 이번 주 건수

### 내보내기 / 백업
- 단건: **TXT · Markdown(요약·할일·메모 포함) · JSON · 오디오 파일**
- **복사**(클립보드) · **공유**(Web Share) · **인쇄**(PDF 저장)
- 전체: **합본 Markdown**, **백업 JSON**(오디오 포함/텍스트만), **복원**

### 설정
- 테마(라이트/다크), 글자 크기
- 저장소 사용량 · **영속 저장**(`storage.persist`)
- 폴더 추가/삭제
- 백업·복원·합본
- **앱 설치 안내**(iOS·삼성·macOS·Chromium 기기별)
- **데이터 초기화**(위험 구역)

---

## 🚀 사용법 (빠른 시작)

1. 브라우저(권장: **Chrome / Edge**)에서 https://mykim711231.github.io/MeetNote/ 접속
2. 설정 탭 → **“홈 화면에 앱 설치”** 로 설치(선택)
3. **녹음 탭**에서 제목·발언자·소스·언어를 정하고 빨간 버튼으로 녹음 시작
4. 말하면 자막이 실시간 생성 → 정지(■) 후 자동 저장
5. **기록 탭**에서 회의록을 열어 재생·요약·할 일·편집·내보내기

> ⚠️ 녹음(마이크)·PWA 설치는 **HTTPS 또는 localhost**에서만 동작합니다.
> 중요한 회의록은 설정 → 백업으로 주기적으로 내보내세요(기기 데이터만 사용하므로).

---

## 🌐 브라우저 지원

| 기능 | Chrome/Edge | Safari | Firefox |
|---|---|---|---|
| 녹음(MediaRecorder) | ✅ | ✅ | ✅ |
| 실시간 자막(Web Speech) | ✅ | 제한적 | ❌ |
| 시스템 소리(getDisplayMedia) | ✅(데스크톱) | 제한적 | 제한적 |
| PWA 설치 | ✅ | ✅(수동) | 부분 |

자막이 핵심이면 **Chrome·Edge** 권장. 자막 미지원 환경에서도 녹음·재생·저장은 정상 동작합니다.

---

## 🛠️ 기술 스택

| 레이어 | 기술 |
|---|---|
| UI | React 18 + TypeScript 5 (strict) |
| 빌드 | Vite 5 |
| PWA | vite-plugin-pwa + Workbox 7 (`registerType: 'prompt'`, silent update) |
| 스타일 | Tailwind CSS 3 + CSS 토큰 다크모드 |
| 상태 | zustand |
| 저장 | IndexedDB (idb-keyval) + localStorage |
| 아이콘 | lucide-react |
| 라우팅 | react-router (HashRouter — GitHub Pages 호환) |

브라우저 API: `MediaRecorder` · `getUserMedia` · `getDisplayMedia` · `Web Speech API` · `AudioContext` · `Wake Lock` · `MediaSession` · `Web Share` · `storage.persist`.

---

## 📁 프로젝트 구조

```
MeetNote/
├── app/                      # Vite 앱
│   ├── src/
│   │   ├── hooks/            # useRecorder, useWakeLock
│   │   ├── lib/              # db, stt, summarize, export, speakers, playpos, format
│   │   ├── stores/          # zustand (meeting, pref, toast, confirm, update)
│   │   ├── components/       # Provider·TabBar·TopBar·Toast·Onboarding·InstallPrompt 등
│   │   ├── routes/           # RecordView · LibraryView · MeetingDetail · SettingsView
│   │   └── types.ts
│   ├── public/icons/
│   └── vite.config.ts
├── .github/workflows/deploy.yml
├── Docs/                     # 사용설명서·기술 조사
└── *.ps1                     # dev / deploy 스크립트
```

---

## 💻 개발

```powershell
cd app
npm install
npm run dev        # http://localhost:5173/  (루트 base)
npm run typecheck
npm run build
```

아이콘 재생성: `node scripts/make-icons.mjs` (sharp 필요)

## 🚢 배포

`main` 푸시 → GitHub Actions → GitHub Pages 자동 배포.

```powershell
.\deploy.ps1 -BuildFirst      # 타입체크·빌드 검증 후 커밋·푸시
```

배포 URL: https://mykim711231.github.io/MeetNote/

---

## 🔒 프라이버시

- 데이터(오디오·자막·메모·설정)는 **사용자 기기의 IndexedDB/localStorage에만** 저장됩니다.
- 서버·클라우드·계정·분석 호출이 **없습니다**.
- 실시간 자막은 브라우저 내장 음성 인식을 사용합니다(브라우저에 따라 인식 처리가 외부에서 이뤄질 수 있음).
- 기기 변경·초기화 전 **백업 내보내기**를 권장합니다.

---

## 📱 플랫폼 / 하이브리드 (Capacitor)

웹(PWA)을 기본으로 하되, **iOS는 Capacitor로 네이티브 앱**으로 감싸 자막을 네이티브 음성인식(SFSpeechRecognizer, 온디바이스)으로 처리합니다 — iOS WKWebView에는 Web Speech API가 없고, 회의 거리(원거리) 자막에 유리하기 때문입니다.

- 코드 분기: `Capacitor.isNativePlatform()` (웹=Web Speech / 네이티브=플러그인). 웹 동작은 그대로 유지.
- 빌드: `npm run cap:ios` (Mac 필요)
- 상세: **[iOS 빌드 가이드](Docs/iOS_빌드_가이드.md)**

> 웹 자막(Web Speech API)은 근접 발화에 강하고 원거리·장시간에 약합니다. 모바일은 네이티브 STT 경로를 권장합니다.

## 📄 문서

- [사용설명서](Docs/사용설명서.md) — 기능별 사용 방법
- [iOS 빌드 가이드](Docs/iOS_빌드_가이드.md) — Capacitor 하이브리드 iOS 빌드/실행
- [회의록 기술 스택 조사](Docs/회의록_기술스택_조사.md) — STT/요약 기술 비교 및 향후 방향
