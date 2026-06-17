# MeetNote iOS 빌드 가이드 (Capacitor 하이브리드)

> 같은 React 코드베이스를 iOS 네이티브 앱으로 감싸고, **자막은 네이티브 음성인식(SFSpeechRecognizer, 온디바이스)** 으로 동작시킵니다.
> iOS WKWebView에는 Web Speech API가 없으므로, 회의 거리(원거리) 자막 문제의 핵심 해결책입니다.

## 왜 하이브리드인가
- 웹(PWA)의 모든 기능(녹음·재생·요약·백업 등)을 **그대로 재사용**
- iOS에서만 자막 경로를 **네이티브 플러그인**으로 교체 (`@capacitor-community/speech-recognition`)
- 코드 분기는 `Capacitor.isNativePlatform()` 한 곳에서 자동 처리 (`src/hooks/useRecorder.ts`, `src/lib/sttNative.ts`)

---

## 사전 준비 (macOS 필요)
- macOS + **Xcode** (App Store)
- **CocoaPods**: `sudo gem install cocoapods` 또는 `brew install cocoapods`
- Node 20+, 유료/무료 Apple 개발자 계정(실기기 설치용)

> ⚠️ iOS 빌드는 **반드시 Mac**에서 합니다. Windows에서는 코드/설정까지만 가능합니다.

---

## 최초 1회 설정

```bash
cd app
npm install
npm run build:app          # dist 생성 (base '/', 네이티브용)
npx cap add ios            # ios/ Xcode 프로젝트 생성 (최초 1회)
npx cap sync ios           # 웹 자산 + 플러그인 동기화
```

### Info.plist 권한 추가 (Xcode → ios/App/App/Info.plist)
아래 키를 추가합니다. 없으면 마이크/음성인식 요청 시 앱이 크래시합니다.

| 키 | 값(설명 문구) |
|---|---|
| `NSMicrophoneUsageDescription` | 회의 녹음을 위해 마이크를 사용합니다. |
| `NSSpeechRecognitionUsageDescription` | 실시간 자막 생성을 위해 음성 인식을 사용합니다. |

백그라운드 녹음을 원하면 **Signing & Capabilities → Background Modes → Audio** 체크 (또는 Info.plist `UIBackgroundModes`에 `audio`).

### 커스텀 플러그인: 파일 자동 전사 (FileTranscribe)
가져온/녹음한 오디오를 **온디바이스로 받아쓰기**하는 네이티브 플러그인입니다. (SFSpeechURLRecognitionRequest)

1. Xcode 프로젝트 네비게이터에서 `App/App` 폴더에 **`app/native/ios/FileTranscribePlugin.swift`** 를 드래그&드롭
   - "Copy items if needed" 체크, **Target: App** 체크
2. (위 Info.plist 권한이 있으면 추가 설정 불필요 — `NSSpeechRecognitionUsageDescription` 필수)
3. 빌드하면 `registerPlugin('FileTranscribe')`(`src/lib/fileTranscribe.ts`)와 자동 연결됨

> 동작: 상세 화면에서 **자동 전사(받아쓰기)** 버튼 → 권한 요청 → 온디바이스 전사 → 문장 단위 자막 저장.
> 웹에서는 이 버튼이 보이지 않습니다(iOS 전용 엔진).

### 음성 메모에서 공유 → MeetNote 가져오기 (문서 타입 등록)
음성 메모 등에서 **공유 → MeetNote** 또는 **MeetNote로 열기** 시 자동으로 회의록으로 가져옵니다.
앱 측 처리는 이미 구현됨(`src/lib/shareImport.ts`, `appUrlOpen` 리스너). Info.plist에 아래만 추가하세요.

`ios/App/App/Info.plist` `<dict>` 안에 추가:
```xml
<key>CFBundleDocumentTypes</key>
<array>
  <dict>
    <key>CFBundleTypeName</key>
    <string>Audio</string>
    <key>LSHandlerRank</key>
    <string>Alternate</string>
    <key>LSItemContentTypes</key>
    <array>
      <string>public.audio</string>
      <string>public.mpeg-4-audio</string>
      <string>com.apple.m4a-audio</string>
      <string>public.mp3</string>
      <string>com.microsoft.waveform-audio</string>
    </array>
  </dict>
</array>
<key>LSSupportsOpeningDocumentsInPlace</key>
<false/>
```
> `LSSupportsOpeningDocumentsInPlace=false` → iOS가 파일을 앱 Inbox로 복사해 읽기 가능한 file:// URL을 넘겨줍니다.
> 동작: 음성 메모 → 공유 → **MeetNote** → 앱이 열리며 자동으로 회의록 생성 → (오디오 있으면) 상세에서 **자동 전사** 가능.

### Xcode 설정
- **Signing & Capabilities** → Team 선택(개인 계정 가능)
- **Deployment Target**: iOS 14.3 이상 (WKWebView MediaRecorder), 온디바이스 전사는 iOS 13+ / 권장 16+(문장부호)

---

## 빌드 / 실행

```bash
npm run cap:ios            # build:app + cap sync ios + Xcode 열기
```
또는 수동:
```bash
npm run build:app && npx cap sync ios && npx cap open ios
```
Xcode에서 실기기 선택 → ▶ 실행.

> 시뮬레이터는 마이크/음성인식이 제한적입니다. **실기기 테스트 권장.**

---

## 코드 변경 후 재배포 사이클
```bash
npm run build:app && npx cap sync ios   # 웹 코드 변경 반영
# Xcode에서 다시 실행
```
(네이티브 플러그인을 추가/변경했을 때만 `pod install`이 다시 돌아갑니다.)

---

## 검증 체크리스트 (실기기)
- [ ] 마이크·음성인식 권한 요청 팝업이 뜨고 허용된다
- [ ] **회의 거리(1~3m)에서 자막이 잡힌다** (Web Speech 대비 핵심 개선 확인)
- [ ] 녹음 → 저장 → 재생 정상
- [ ] 1분 이상 연속 인식 시 자막이 끊기지 않고 이어진다 (`sttNative.ts`의 재시작 로직)
- [ ] 백그라운드(화면 잠금) 시 녹음 지속 (Background Audio 설정 시)

> 네이티브 STT 동작(`src/lib/sttNative.ts`)은 실기기에서만 검증/튜닝 가능합니다.
> 자막 끊김·지연이 있으면 재시작 간격(250ms)·partialResults 처리부를 조정하세요.

---

## 향후: iOS 26 SpeechAnalyzer
현재는 `SFSpeechRecognizer`(iOS 13+, 안정·온디바이스) 기반 커뮤니티 플러그인을 사용합니다.
장문 회의 정확도/속도를 더 높이려면 iOS 26 **SpeechAnalyzer/SpeechTranscriber**를 감싸는
커스텀 Capacitor 플러그인을 작성해 `sttNative.ts`의 구현만 교체하면 됩니다(인터페이스 `SttSession` 동일).
