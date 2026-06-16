# MeetNote 회의록

서버·계정·비용 없이 **기기에서만 동작하는 개인용 회의록 녹음 PWA**.
녹음 · 실시간 자막 · 요약 · 할 일 추출 · 오디오 재생을 모두 오프라인·로컬에서 처리합니다.

## 기술 스택

| 레이어 | 기술 |
|---|---|
| UI | React 18 + TypeScript 5 (strict) |
| 빌드 | Vite 5 |
| PWA | vite-plugin-pwa + Workbox 7 (`registerType: 'prompt'`) |
| 스타일 | Tailwind CSS 3 + CSS 토큰 다크모드 |
| 상태 | zustand |
| 저장 | IndexedDB (idb-keyval) + localStorage |
| 아이콘 | lucide-react |

## 핵심 기능

- **녹음**: `MediaRecorder`로 마이크 캡처 · 일시정지/재개 · 음량 레벨 미터
- **실시간 자막**: `Web Speech API` (ko-KR, Chrome·Edge)
- **재생**: 자막 클릭 → 해당 구간 점프 · 배속(0.75~2×)
- **정리**: 규칙 기반 요약 · 할 일 자동 추출 (LLM·서버 불필요)
- **저장**: IndexedDB에 오디오 Blob 저장 · 폴더/검색 · `storage.persist()` 영속화
- **백업**: 전체 회의록+오디오 JSON 내보내기/복원
- **PWA**: 오프라인 동작 · 홈 화면 설치 · `Wake Lock`(녹음 중 화면 유지)

## 개발

```powershell
cd app
npm install
npm run dev        # http://localhost:5175/MeetNote/
npm run typecheck
npm run build
```

> ⚠️ 녹음(마이크)·PWA 설치는 **HTTPS 또는 localhost**에서만 동작합니다.

## 배포

GitHub Actions → GitHub Pages 자동 배포. `.\deploy.ps1 -BuildFirst` 로 커밋·푸시.

- 배포 URL: https://mykim711231.github.io/MeetNote/
