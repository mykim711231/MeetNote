# MeetNote 회의록 앱 — Claude Code 구현 지침서

> 이 문서를 Claude Code에 그대로 전달하면 누락 없이 구현 가능하도록 작성됨.
> 적대적 검토(Adversarial Review) 관점에서 실패 모드·엣지케이스·브라우저 함정을 명시함.
> **각 요구사항에는 `[필수]`/`[권장]` 라벨과 `검증:` 항목이 있다. 구현 후 검증 항목을 모두 통과해야 완료로 간주한다.**

---

## 시작하기 — Claude Code에 넘기는 방법

두 가지 경로가 있다. **권장은 경로 B.**

### 경로 B (권장): 기존 코드를 적대적 검토 후 보강
이미 동작하는 `meetnote.html`이 있다. 이것과 본 지침서를 같은 폴더에 두고 Claude Code에 아래 프롬프트를 준다.

```
첨부된 meetnote.html과 IMPLEMENTATION_SPEC.md를 읽어라.
너는 이 코드의 적대적 검토자(adversarial reviewer)다.
1. 지침서 7장 체크리스트의 모든 항목을 코드에 대해 실제로 검증하라.
2. 각 항목을 통과/실패로 판정하고, 실패 근거를 코드 라인과 함께 제시하라.
3. 실패한 항목만 최소 변경으로 수정하라. 통과 항목은 건드리지 마라.
4. 외부 라이브러리 추가·서버 도입·기능 축소 금지. 필요하면 먼저 질문하라.
5. 수정 후 전체 체크리스트 재검증 결과표를 보고하라.
6. 결과물은 단일 파일 meetnote.html 하나로 유지하라.
```

### 경로 A: 백지에서 새로 구현
`meetnote.html`을 주지 않고 본 지침서만 준다. 본 문서는 3.5장(유틸), 4.5/4.6장(요약·할일 알고리즘 정확한 코드)을 포함해 **자기완결적**이다.

```
IMPLEMENTATION_SPEC.md를 읽고 meetnote.html을 처음부터 구현하라.
- 3.5장 유틸과 4.5/4.6장 알고리즘은 제시된 코드를 그대로 사용하라.
- 1~6장을 모두 충족하고, 7장 체크리스트의 [정적] 항목을 전부 검증하라.
- [수동] 항목은 "로직 구현됨"까지만 확인하고 실제 테스트는 사람 몫임을 보고하라.
- 구현 후 체크리스트 결과표(정적 통과/수동 미검)를 보고하라. 단일 파일, 의존성 0.
```

---

## 검증 방법 분류 (중요 — 먼저 읽을 것)

이 문서의 `검증:` 및 7장 체크리스트 항목은 두 종류다. Claude Code는 헤드리스 환경이므로 물리 장치(마이크·화면잠금·실제 터치)를 테스트할 수 없다. 따라서:

- **[정적]** 코드 정적 검사로 검증 가능 — 해당 코드 경로·가드·`try/catch`·이스케이프 처리가 존재하는지 읽어서 확인. Claude Code가 **반드시** 수행.
- **[수동]** 실제 기기/브라우저에서 사람이 확인해야 함 — Claude Code는 "해당 로직이 코드에 구현되어 있음"까지만 정적 확인하고, 실제 동작 테스트는 **사람 몫**임을 보고서에 명시. 통과를 임의로 단정하지 말 것.

각 체크리스트 항목 앞에 `[정적]`/`[수동]`을 표기했다. **[수동] 항목을 "통과"로 거짓 보고하지 말 것.**

---

## 0. 한 줄 요약

브라우저만으로 동작하는 무료·로컬·오프라인 회의록 앱. 단일 HTML 파일(`meetnote.html`), 외부 의존성 0, 빌드 과정 0, 서버 0. 한국어(`ko-KR`) 우선.

## 1. 절대 제약 (이걸 어기면 전부 무효)

- **[필수] 단일 파일.** HTML+CSS+JS를 `meetnote.html` 하나에 인라인. npm·프레임워크·번들러 금지.
- **[필수] localStorage 외 저장소 금지.** 서버·DB·클라우드·분석 호출 일절 없음.
- **[필수][예외 2건] 외부 요청은 ① 구글폰트 CSS(`fonts.googleapis.com`/`fonts.gstatic.com`)와 ② OCR 사용 시에만 지연 로딩되는 Tesseract.js(`cdn.jsdelivr.net`)만 허용.** 폰트는 항상, OCR 엔진은 **사용자가 OCR 버튼을 처음 누를 때만** 동적 `<script>` 삽입으로 로드. 그 외 `fetch`·`XHR`·분석 스크립트는 전면 금지.
  - 검증: [정적] 초기 HTML에 Tesseract `<script src>` 없음(지연 로딩), 외부 `fetch`/`XHR` 0건, 정적 `<link href>`는 구글폰트 2건만.
- **[필수] 폰트 없이도 동작.** 글꼴 CDN이 차단/오프라인이어도 `font-display:swap`과 fallback 체인(`var(--serif)`/시스템폰트)으로 **앱 기능은 100% 정상**. 손글씨/명조만 시스템 글꼴로 대체될 뿐.
- **[필수] 오프라인 동작.** `file://`·비행기 모드에서도 모든 기능(요약·할일·메모·백업 포함) 동작. 예외는 ① 음성인식(4.3) ② 글꼴 모양(위). 둘 다 기능 자체는 살아 있음.

## 2. 정보 구조 (탭 6개 + 헤더)

헤더 좌측: 브랜드(`회의록.` / `MeetNote`, 브랜드는 선택 글꼴 적용). 헤더 우측: **설정 3버튼 + 시계** — `Aa`(글꼴 변경) / `가`(글자 크기) / `◐`(다크모드) / 실시간 시계. (설정 동작은 4.9 참고)
탭 6개 순서: `녹음` / `검토` / `요약` / `할 일`(개수 배지) / `기록`(개수 배지) / `메모`(개수 배지).

**[필수] 탭 전환 시 진행 중인 모든 음성인식을 중지한다.** Web Speech API는 페이지당 인식 1개만 허용하므로, 탭 핸들러 첫 줄에서 `stopAllStt()`(녹음·검토·메모 STT를 모두 멈추는 헬퍼)를 호출한다. 이 가드가 없으면 녹음 중 메모 탭에서 음성입력을 켤 때 엔진이 충돌하고, 떠난 탭의 인식이 백그라운드에서 마이크를 계속 점유한다.

- **[필수] 탭 전환은 표시/숨김(`.active` 클래스 토글)만.** SPA 라우팅·해시 불필요.
- 검증: 각 탭 클릭 시 해당 뷰만 보이고 나머지는 `display:none`.

## 3. 데이터 모델 (정확히 이 스키마 사용)

```js
// localStorage 키
DB_KEY     = "meetnote.meetings.v1"
SPK_KEY    = "meetnote.speakers.v1"
FOLDER_KEY = "meetnote.folders.v1"
MEMO_KEY   = "meetnote.memos.v1"
PREF_KEY   = "meetnote.prefs.v1"        // { theme, fontIdx, fontFace }
ISSUE_STATE_KEY = "meetnote.issuestate.v1"  // { "<meetingId>::<issueHash>": "open"|"discuss"|"resolved" }

// 회의록 1건
{
  id: number,            // Date.now()
  title: string,
  date: string,          // ISO 8601
  duration: number,      // ms
  segments: [ { who: string, text: string, ts: number /* ms, 시작 기준 */ } ],
  folderId: string|null, // 소속 폴더 id (없으면 null = 미분류)
  type: string,          // "general"|"interview"|"issue"|"decision" (회의 유형)
  summary: null,         // 예약 필드
  actions: null          // 예약 필드
}

// 폴더 1개: { id: "f"+Date.now(), name: string }   — 1단계(중첩 없음)
// 메모 1건: { id, text, date, pinned, label, folderId }  (첫 줄이 제목 — 별도 title 없음)
// 발언자 목록: string[] (기본 ["나","상대"])
```

- **[필수] `ts`는 항상 밀리초(ms).** 검토 탭의 `audioTime`(초)을 저장할 때 반드시 `*1000` 변환. (이 단위 혼동이 가장 흔한 버그)
  - 검증: [정적] 저장 코드에서 `audioTime*1000` 변환이 있는지. [수동] 두 탭 저장본의 타임스탬프 표시 확인.
- **[필수][알려진 한계] `summary`/`actions`는 현재 항상 `null`로 저장된다.** 요약·할일은 탭에서 즉석 생성만 하고 회의록에 영속화하지 않는다. 의도된 동작이며 경로 A도 동일하게 `null` 고정. 바꾸려면 먼저 질문할 것.
- **[필수] 모든 쓰기 헬퍼(`saveDB`/`saveFolders`/`saveMemos`)는 `try/catch`+boolean 반환.** QuotaExceeded 시 토스트 후 false.

## 3.5 공통 유틸 — 정확한 구현 (경로 A는 그대로 사용)

```js
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// HTML 이스케이프 — 모든 사용자 문자열은 innerHTML 삽입 전 반드시 통과
function esc(s){ return (s||"").replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

// ms → "MM:SS"
function fmtT(ms){ const s=Math.floor(ms/1000);
  return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0"); }

// 초 → "MM:SS" (검토 탭 audioTime용)
function audioStamp(sec){ return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(Math.floor(sec%60)).padStart(2,"0"); }

// 하단 중앙 토스트 (2.2초 후 사라짐)
let toastT;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2200); }
```

폰트 스택 (CSS 변수, 그대로 사용):
```css
--sans: -apple-system,BlinkMacSystemFont,"Segoe UI","Pretendard","Apple SD Gothic Neo",sans-serif;
--serif:"Iowan Old Style","Apple Garamond","Times New Roman",Georgia,serif;
--mono: "SF Mono",ui-monospace,"Cascadia Code","Roboto Mono",Menlo,monospace;
```

## 4. 기능별 상세

### 4.1 녹음 탭 (실시간 받아쓰기) `[필수]`

- 제목 입력 / 타이머(`MM:SS`) / 녹음 시작·중지 / 저장 / 새로(초기화) / 상태표시줄.
- **Web Speech API** 사용: `SpeechRecognition || webkitSpeechRecognition`.
  - `lang="ko-KR"`, `continuous=true`, `interimResults=true`, `maxAlternatives=1`.
- 발언자 칩: 현재 발언자를 누른 뒤 말하면 그 발언자로 세그먼트 저장. `+ 발언자`로 추가(`prompt`).
- 화면에 실시간 자막(확정 세그먼트 + interim 임시 텍스트 이탤릭).

**적대적 검토 — 반드시 처리할 실패 모드:**
- **[필수] `continuous`가 모바일에서 자동으로 끊긴다.** `onend`에서 `recognizing && !restartGuard`이면 `recog.start()` 자동 재시작. 단, 의도적 중지(stop) 시엔 `restartGuard=true`로 재시작 막고 ~400ms 후 해제. (재시작 루프 폭주 방지)
- **[필수] `onerror` 분기.** `not-allowed`/`service-not-allowed` → 마이크 권한 안내 + 녹음 중지. `no-speech` → 무시하고 계속(흔함).
- **[필수] `recog.start()`를 이미 시작된 인스턴스에 또 호출하면 `InvalidStateError` 던짐.** 모든 `start()`는 `try{}catch{}`로 감쌀 것.
- **[권장] 매 녹음마다 `buildRecog()`로 새 인스턴스 생성** (재사용 시 상태 꼬임).
- **[필수] 저장 버튼은 세그먼트 0개면 비활성**(`disabled`).
- **[필수] '새로' 클릭 시 세그먼트 있으면 `confirm`으로 확인. 동시에 `loadedMeetingId=null`로 리셋.**
- **[필수] 재저장 갱신(중복 방지):** 전역 `loadedMeetingId`로 "기록에서 불러온 회의"를 추적한다. `loadMeeting(m)`은 `m.id`를 기억(단, 탭 `.click()`이 먼저 실행되므로 그 *뒤*에 설정). 저장 시 `loadedMeetingId`가 가리키는 회의가 db에 있으면 **그 항목을 갱신**(title/date/duration/segments만 수정, folderId 유지), 없으면 신규 `unshift`. 이게 없으면 불러온 회의를 저장할 때마다 복제본이 쌓인다.
- 검증: [정적] `loadedMeetingId` 분기·`새로`에서 리셋 존재. [수동] 불러온 회의 저장 시 개수 안 늘고 폴더 유지.
- **[필수] 타임라인 연속성(이어 녹음·불러온 회의 이어가기):** 세그먼트 `ts`는 단순 `Date.now()-startTime`이 아니라 **`baseElapsed + (Date.now()-startTime)`**. `baseElapsed`는 누적 경과시간(ms)으로 ① 중지 때 `baseElapsed += Date.now()-startTime` 누적 ② '새로'에서 `0`으로 리셋 ③ `loadMeeting`에서 그 회의의 `duration`으로 설정. 이게 없으면 멈췄다 다시 녹음하거나 불러온 회의를 이어 녹음할 때 타임스탬프가 0으로 되돌아가 타임라인이 깨진다. 타이머 표시도 동일 식 사용.
  - 검증: [정적] `baseElapsed` 누적/리셋/loadMeeting 설정 존재. [수동] 멈췄다 재녹음 시 ts가 이어지는지.
- **[필수] 자막 증분 렌더링(긴 회의 성능):** `renderTranscript`는 매 인식 결과마다 전체를 다시 그리면 안 된다(수백 발언에서 끊김). `_renderedSegCount`로 **새 세그먼트만 append**하고, interim(진행 중) 줄은 떼었다가 새 확정분을 붙인 뒤 다시 맨 끝에 단다(순서 보장). 불러오기·초기화는 `rerenderTranscript()`로 전체 재생성 후 카운터 리셋.
  - 검증: [정적] 증분 append·interim 분리·rerender 존재. [수동] 발언 100+ 회의에서 입력 지연 없음.

### 4.1.1 검토 탭 단축키 가드 보강 `[필수]`
- 단축키(Space 재생/정지, 1–9 발언자) 핸들러는 **활성 탭 확인 + INPUT·TEXTAREA 제외 + 스테이지 표시 확인** 3중 가드. (TEXTAREA 누락 시 메모 입력 중 스페이스가 재생 토글로 새는 버그)

### 4.2 Wake Lock — 화면 자동잠금 방지 (설정 토글) `[필수]`

- 녹음 탭에 토글 스위치, **기본 ON**. `navigator.wakeLock.request("screen")`.
- 녹음 시작 시 `requestWakeLock()`, 중지 시 `releaseWakeLock()`.
- **[필수] `visibilitychange`로 앱 복귀 시 재요청.** Wake Lock은 탭이 백그라운드 가면 OS가 자동 해제하므로, `visibilityState==="visible" && recognizing`이면 다시 요청.
- **[필수] 미지원/거부 시 조용히 무시**(`try/catch`), 토글 켤 때 미지원이면 토스트 안내.

**적대적 검토 — 정직성 요구사항(중요):**
- **[필수] Wake Lock은 "화면 자동 꺼짐"만 막는다. 사용자가 전원버튼으로 끄거나 OS 강제 절전 시 음성인식은 멈춘다.** UI에 이 한계를 거짓 없이 표기할 것. "백그라운드 완전 기록"이라고 과장 표기 금지.
- **[필수] 진짜 백그라운드 기록 = 4.4 검토 탭 경로**(폰 기본 녹음 앱)임을 UI에 안내.
- 검증: 토글 OFF 시 wake lock 해제됨. iOS Safari(미지원 가능)에서 토글 켜도 앱이 죽지 않음.

### 4.3 음성인식 브라우저 제약 (정직하게 표기) `[필수]`

- 지원 현황(2025 기준, 변동 가능): **Chrome/Edge(데스크톱·안드로이드) 양호.** Safari는 `webkitSpeechRecognition`이 존재하나 한국어 연속 인식이 불안정하고 기기/버전에 따라 동작이 다름 — "권장 안 함"으로 안내. Firefox는 미지원.
- `SR`(`SpeechRecognition || webkitSpeechRecognition`)이 없으면 녹음 버튼 비활성 + 경고 배너: "이 브라우저는 실시간 받아쓰기 미지원. Chrome/Edge 권장." 단 요약·할일·검토(수동 태깅)는 여전히 동작하게.
- **[필수] 업로드한 오디오 파일을 Web Speech API에 직접 넣을 수 없다**(마이크 입력만 받음). 검토 탭의 "마이크로 받아쓰기"는 스피커 재생음을 마이크로 다시 받는 우회법임을 명시.

### 4.4 검토 탭 (녹음 듣고 정리) `[필수]`

회의 중 폰 기본 녹음 앱으로 녹음 → 끝나고 파일 업로드 → 들으며 정리.

- 파일 업로드(`<input type=file accept="audio/*">`), `URL.createObjectURL`로 `<audio controls>`에 로드.
- 배속 버튼(0.75 / 1 / 1.25 / 1.5 / 2×) → `player.playbackRate`.
- 점프 버튼(−10 / −5 / +5초) → `player.currentTime` 가감.
- 두 모드 전환:
  - **① 화자·메모 찍기:** 발언자 칩 누르면 `player.currentTime`에 구간 생성. 메모 입력칸 + Enter. 구간은 시간순 정렬.
  - **② 마이크로 받아쓰기:** 스피커 재생 + 마이크 STT 동시. 4.1과 같은 SR 로직 별도 인스턴스(`revRecog`).
- 정리된 구간: 탭하면 그 시점으로 점프(`currentTime` 이동), 텍스트 탭하면 메모 편집(`prompt`).
- 키보드 단축키(검토 탭 활성 + INPUT 포커스 아닐 때만): `Space`=재생/정지, `1~9`=해당 발언자로 구간 찍기.

**적대적 검토 — 반드시 처리:**
- **[필수] 단축키 가드:** ① 검토 탭이 active일 때만 ② `e.target.tagName==="INPUT"`이면 무시(메모 입력 중 스페이스가 재생 토글하면 안 됨) ③ 스테이지 미표시면 무시. `Space`는 `preventDefault()`로 페이지 스크롤 방지.
- **[필수] `createObjectURL` 누수:** 새 파일 로드 시 이전 objectURL을 `revokeObjectURL`로 해제(또는 최소한 인지). 장시간 사용 시 메모리 누수.
- **[필수] `audioTime` 단위(초) → 저장 시 `*1000`(ms).** (3장 재확인)
- **[필수] 메모 없는 구간 허용** — 화자만 찍고 메모 비어도 저장되고, 저장 시 "(메모 없음)"으로 대체.
- **[필수] 발언자 칩은 녹음 탭과 검토 탭이 같은 `speakers` 배열 공유.** 한쪽에서 추가하면 양쪽 모두 갱신(`renderSpeakers()` + `renderRevSpeakers()`).
- 검증: ① 메모칸에서 스페이스 입력해도 재생 안 바뀜 ② 구간 탭하면 정확한 위치로 점프 ③ 파일 두 번 바꿔 로드해도 정상.

### 4.5 요약 탭 (규칙 기반, 로컬) `[필수]`

- 입력: `activeSegments()`가 반환하는 현재 활성 세그먼트.
- 출력: 핵심 문장 목록 + 키워드 칩(빈도수 표시).

**정확한 알고리즘 (경로 A는 이 코드를 그대로 구현):**

```js
// 불용어
const STOP=new Set("그 이 저 것 수 등 및 또 또한 그리고 하지만 그래서 그런데 우리 저희 제가 너무 정말 진짜 약간 좀 거의 매우 아주 그냥 이제 이게 그게 저게 근데 라고 라는 한다 합니다 했다 했습니다 입니다 이다 됩니다 거예요 인데 에서 으로 에게 한테 까지 부터 으로서 처럼 보다 만큼".split(/\s+/));

// 토크나이즈: 한글/영문/숫자 추출 → 흔한 조사·어미 제거 → 2자 이상 & 불용어 제외
function tokenize(text){
  return (text.match(/[가-힣A-Za-z0-9]+/g)||[])
    .map(w=>w.replace(/(은|는|이|가|을|를|에|의|도|만|과|와|로|으로|에서|에게|한테|까지|부터|이라|라고|라는|하는|하고|해서|했고|되는|된|할|함)$/,""))
    .filter(w=>w.length>=2 && !STOP.has(w));
}
// 키워드: 빈도 × 길이가중(긴 단어 우대). score=freq*(1+(len-2)*0.15), 상위 n개
function keywords(text,n=8){
  const f={};tokenize(text).forEach(w=>f[w]=(f[w]||0)+1);
  return Object.entries(f).map(([w,c])=>[w,c,c*(1+(w.length-2)*0.15)])
    .sort((a,b)=>b[2]-a[2]).slice(0,n).map(([w,c])=>[w,c]);
}
// 자카드 유사도(중복 문장 제거용)
function jaccard(a,b){const A=new Set(tokenize(a)),B=new Set(tokenize(b));
  if(!A.size||!B.size)return 0;let i=0;A.forEach(x=>{if(B.has(x))i++});return i/(A.size+B.size-i);}

// 요약 점수(고도화):
//  키워드 가중치 맵 kwW[w]=1-순위*0.06 → 문장의 키워드 가중합
//  + 결정/이슈/목표 표현(/결정|합의|정리|결론|하기로|로 정|확정|목표|이슈|문제|중요/) +2.5
//  × 위치가중(도입 0~0.15 / 마무리 0.85~1 구간 ×1.18)
//  ÷ sqrt(len+1) × min(1, len/8)  (너무 짧은 문장 패널티)
//  상위 점수 순회하며 jaccard≥0.6 중복 제거, want=min(6,max(3,ceil(N*0.3)))개 선택
//  최종 idx 순서로 정렬해 표시. 4자 이하 문장 제외.
```

**activeSegments() — 상태 우선순위 (결함 수정 포함):**

```js
// 우선순위: 검토 탭이 active 이고 revSegments가 있으면 검토 데이터, 그 외에는 녹음 segments.
// 반환 형식은 항상 {who,text,ts(ms)}로 정규화.
function activeSegments(){
  return (typeof revSegments!=="undefined" && revSegments.length && $("#view-rev").classList.contains("active"))
    ? revSegments.map(s=>({who:s.who, text:s.text||"", ts:(s.audioTime||0)*1000}))
    : segments;
}
```

- **[필수] 명시적 우선순위 주의:** "검토 탭이 **현재 active**"일 때만 검토 데이터를 쓴다. 요약/할일 탭에서 버튼을 누르는 시점엔 검토 탭이 active가 아니므로 → `segments`(녹음 또는 기록에서 불러온 회의)를 사용한다. 즉 **기록에서 회의를 불러와 요약하면 그 회의가 요약된다.** 검토 탭 데이터가 남아 있어도 간섭하지 않는다. (이전 모호함 해소)
- **[필수] `revSegments`가 `summarize` 정의보다 늦게 `let` 선언되므로 `typeof` 가드로 ReferenceError 방지.**
- **[필수] 세그먼트 0개 / 4자 이하 발언만 있을 때** "요약할 핵심 내용 없음" 안내(크래시 금지).
- 검증: [정적] 위 우선순위 분기·typeof 가드·빈입력 분기 존재 확인.

### 4.5.1 회의 유형 + 유형별 분석 `[필수]`

회의의 목적은 **이슈 관리**와 **인터뷰 기반 의사결정**. 그래서 회의마다 유형을 정하고, 유형에 맞는 분석을 요약 탭 전면에 노출한다.

- **유형 선택:** 녹음 화면 제목 아래에 `일반 / 인터뷰 / 이슈관리 / 의사결정` 세그먼트 컨트롤. 전역 `meetingType`에 보관, 회의 저장 시 `type` 필드로 저장, `loadMeeting`에서 복원, '새로'에서 `"general"` 리셋.
- **`applyMeetingType()`**: 요약 탭에서 유형 전용 버튼/카드를 토글. 현재 유형의 버튼만 노출하고 나머지 유형의 버튼·결과 카드는 숨긴다(유형 전환 시 이전 결과 잔존 방지). 탭이 sum으로 바뀌거나 유형이 바뀔 때 호출. 초기 1회 호출로 일반 유형이면 전용 버튼 숨김.
- 모든 유형 공통으로 **자동 요약·할일**은 계속 제공. 유형 전용 분석이 그 위에 추가된다.

**① 인터뷰 — Q&A 정리 (`buildQA`)**
- 질문 감지: 물음표 또는 한국어 의문형 어미(`~까요/나요/ㄴ가요/는지/입니까/세요`, `왜/무엇/뭐/어디/언제/누가/누구/어떻게/얼마/몇`).
- 답변 묶기: 질문 뒤, 다음 질문 전까지의 **다른 발언자** 발언을 답변으로(최대 4개). 질문자가 이어 말하면 첫 줄은 건너뜀.
- 출력: `Q1, Q2…` + 답변(발언자 배지). 답변 없으면 "답변이 기록되지 않았습니다".

**② 의사결정 — 결정사항 추출 (`buildDecisions`)**
- 결정 신호 `DECISION_RE`: `~기로 했/함`, `~로 정했/확정`, `결정/합의/확정/채택/승인 + 했/됨/하기로`, `결론을 내/지었`. 반려 신호 `REJECT_RE`: `반려/보류하기로/취소하기로/기각/무산`.
- 문장 분리 후 신호 매칭, `jaccard≥0.7` 중복 제거, 마감 표현(📅) 추출. 결정=✅ / 반려=🚫 아이콘 + 제안·결정 발언자 표기.
- **단순 의향("~하자")·일상 대화는 제외**(확정 표현만).

**③ 이슈관리 — 이슈 추출 + 상태 추적 (`buildIssues`)**
- 이슈 신호 `ISSUE_RE`: `문제/이슈/쟁점/우려/리스크/위험/버그/오류/장애/병목/지연/막혀/안 되/실패/불만/걱정/해결해야/개선·논의·검토 필요`.
- 문장 분리 후 매칭, `jaccard≥0.65` 중복 제거. 각 이슈에 **상태 토글**(🔴열림/🟡논의중/🟢해결).
- **상태는 영속:** `ISSUE_STATE_KEY`에 `"<meetingId|cur>::<issueHash>": state`로 저장. `issueHash`는 텍스트 해시. 불러온 회의면 meetingId로, 현재 녹음 중이면 `"cur"` 키. 다시 분석해도 상태 유지.
- 검증: [정적] 세 `build*` 함수·유형 토글·`ISSUE_STATE_KEY` 영속 존재. [수동] 유형별 버튼 노출·정규식 매칭 품질·이슈 상태 새로고침 후 유지.


### 4.6 할 일·액션아이템 탭 (규칙 기반) `[필수]`

- 출력: 체크박스 + 담당자(발언자) 배지 + 내용. 체크 시 취소선. 탭 배지에 개수.

**정확한 알고리즘 (고도화):**

```js
// 강한 신호(명령·약속·결정) — 단독으로 확실한 할 일
const ACTION_STRONG=/(하기로|해야|해주세요|해주|부탁|할게요|할게|하겠|할 것|처리|진행하기|준비해|확인해|전달해|공유해|작성해|보내|연락해|예약|등록해|검토해|마무리|업로드|올려)/;
// 약한 신호(보조)
const ACTION_WEAK=/(확인|전달|공유|작성|정리|검토|진행|완료|체크|업데이트|만들|결정|합의)/;
// 마감 표현 추출
const DUE_RE=/(오늘|내일|모레|이번\s?주|다음\s?주|이번\s?달|다음\s?달|월~금요일|주말|N월 N일|N일까지|N시까지)/; // (실제 코드 정규식 참조)
// 세그먼트→문장분리(/(?<=[.!?。])\s+|(?:고 |며 |\s*[,，]\s*)/) → 길이>3 & (strong||weak)
//   jaccard≥0.7 유사 항목 제거, due=DUE_RE 매칭, owner=seg.who
//   strong 우선 정렬, 마감은 📅 배지로 표시
```

- **[필수] `activeSegments()`** 사용(4.5와 동일 우선순위).
- 검증: [정적] STRONG/WEAK 구분·jaccard 중복제거·DUE 추출·strong 우선정렬 존재. [수동] 액션 없는 회의 "찾지 못함", 체크 토글.

### 4.7 기록 탭 + 폴더 + 내보내기/가져오기 (백업·복원) `[필수]`

- 저장된 회의록 카드 목록(제목/날짜/발언수/길이/미리보기 2줄, 폴더 배지). 탭하면 불러오기, ×는 `confirm` 후 삭제(`stopPropagation`), **이동** 버튼으로 폴더 변경.
- **폴더(1단계, 중첩 없음):** 상단 폴더 칩 `전체 / 미분류 / (사용자 폴더…)`, 각 칩에 개수 배지. `+ 폴더`로 생성, 칩의 `⋯`로 이름변경(비우면 삭제→안의 회의는 미분류로). 칩 선택 시 그 폴더만 필터. **특정 폴더 선택 상태에서 새로 저장하면 그 폴더에 자동 배치.**
- 내보내기: 텍스트(.txt) / 마크다운(.md) / 전체 백업(.json). `Blob` + `createObjectURL` 다운로드.
- **전체 백업 형식:** `{ meetings:[...], folders:[...], memos:[...] }` (회의록·폴더·메모 모두 포함).
- **가져오기(import, 병합):** "백업 가져오기(JSON)" 버튼 + 숨김 `<input type=file accept="application/json,.json">`. 기존 데이터에 병합(회의·폴더·메모 각각 id 중복 건너뜀).
- 기록 탭 상단에 **폰→PC 백업 5단계 안내문**.

**정확한 가져오기 알고리즘 (경로 A는 그대로 구현):**

```js
function validMeeting(m){
  return m && typeof m==="object" && typeof m.id!=="undefined"
    && Array.isArray(m.segments)
    && m.segments.every(s=>s&&typeof s.who==="string"&&typeof s.text==="string"&&typeof s.ts==="number");
}
// 형식 허용: (구) 회의록 배열  또는  (신) {meetings, folders, memos}
//   Array.isArray(parsed) → meetings=parsed
//   parsed.meetings 배열 → meetings/folders/memos 각각 추출
//   그 외 → [parsed] (단건)
// validMemos = memos.filter(id/title/text 타입 검사)
// 회의·메모 둘 다 없으면 "가져올 데이터 없음" 후 중단
// 폴더 병합(id 중복 제외) → saveFolders
// 메모 병합(id 중복 제외) → saveMemos + memoCountUpd
// 회의 병합(id 중복 제외, folderId 보존) → id 내림차순 → saveDB(성공 시에만 렌더)
// 토스트: "회의 N건(중복 X), 메모 M건"
// 모든 종료 경로에서 input.value="" 초기화
```

**적대적 검토 — 반드시 처리:**
- **[필수] JSON 파싱 실패 → 토스트 후 중단.**
- **[필수] 구·신 형식 + 단건 모두 허용**(하위호환). 메모만 있는 백업도 받아들임.
- **[필수] `validMeeting`/메모 타입검사 통과분만 저장.**
- **[필수] 회의·폴더·메모 각각 id 중복 병합(덮어쓰기 아님), 회의의 `folderId` 보존.**
- **[필수] 각 save 헬퍼 boolean 확인 후 렌더.**
- **[필수] `input.value=""` 초기화.**
- 검증: [정적] validMeeting·3종 중복Set·folderId보존·input초기화 존재. [수동] 손상 파일 거부, 중복 안 늘어남.

**[알려진 한계] (UI/README에 정직하게 표기):**
- 검토 탭 **오디오 파일은 백업에 미포함**(앱이 저장 안 함). 오디오는 폰 파일 자체를 카톡/USB로 옮길 것.
- QR/자동 무선 전송 **없음**(서버 0). 수동 파일 전달이 유일 경로.
- 폴더는 **앱 내부 논리적 분류**이지 PC 실제 파일시스템 폴더가 아님. 1단계(중첩 없음).
- 아이폰+윈도우: 케이블 백업 불필요. 브라우저 내부 데이터는 케이블로 못 빼냄 → 카톡 '나와의 채팅'/메일이 최선.

### 4.8 메모 탭 (자체 메모장) `[필수]`

- **목록 뷰**: 검색창(제목+본문 실시간 필터) + `+ 새 메모`. 메모 카드(제목/날짜/2줄 미리보기), 탭하면 편집.
- **편집 뷰**: `‹ 목록` / `삭제`(우측), 제목 입력, 본문 `<textarea>`, `음성 입력`(STT) 버튼.
- **자동 저장**: 제목·본문 `oninput` → 600ms 디바운스 후 `persistMemo`("저장 중…→저장됨"). 제목·본문 모두 비면 빈 메모 자동 삭제.
- **음성 입력(STT)**: 녹음 탭과 같은 SR 로직의 **별도 인스턴스**(`memoRecog`). `interimResults=true`로 **말하는 도중 회색 미리보기**(`#memoInterim`)를 본문 아래 표시, **확정분만 커서 위치에 삽입**(공백 보정). 중지/탭이동 시 미리보기 숨김.
- **[필수] iOS 실제 메모 앱과 연동 불가**(브라우저 한계) — 앱 내부 저장임을 명시. 메모는 전체 백업에 포함됨.
- 검증: [정적] 디바운스 자동저장·빈메모 정리·interim 미리보기·커서 삽입·별도 SR 인스턴스 존재. [수동] 음성입력 중 미리보기 표시, 타이핑과 혼용.

**[삭제됨] TTS(읽어주기) 기능은 제거되었다.** 이유: ① 스피커로 읽어준 음성을 켜져 있는 STT가 되받아쓰는 충돌, ② `getVoices()` 비동기 미로딩, ③ `speechSynthesis` ~15초 끊김 버그. 경로 A에서도 **TTS를 구현하지 않는다.** 추가가 필요하면 먼저 질문할 것.

### 4.9 설정 — 글꼴·글자크기·다크모드 `[필수]`

헤더 우측 3버튼, 모두 `PREF_KEY`에 저장하고 로드 시 즉시 적용.

- **글꼴(`Aa`)**: 3종 순환 `손글씨(hand) → 고딕(gothic) → 명조(myeongjo)`. `html[data-font="..."]`로 `--app-font` 교체. 손글씨=`"Nanum Pen Script"`(구글폰트), 고딕=시스템 sans, 명조=`"Nanum Myeongjo"`. **손글씨 외 글꼴은 제목 크기/굵기 보정 CSS** 적용(손글씨용 큰 사이즈가 과해 보이지 않게). `prefs.fontFace`.
- **글자크기(`가`)**: `FONT_STEPS=[15,16,17,19,21]`px 순환, `--fs` 변수 갱신. `prefs.fontIdx`(기본 1).
- **다크모드(`◐`)**: `html[data-theme="dark"]`로 색 토큰 교체 + `theme-color` 메타 갱신. `prefs.theme`. **최초 진입 시 `prefers-color-scheme: dark`면 자동 다크.**
- 폰트 로드: `<head>`에 구글폰트 `<link>`(Nanum Pen Script + Nanum Myeongjo + Gaegu), `display=swap`.
- 검증: [정적] 3종 프리셋·FONT_STEPS·data-theme 토큰·prefers-color-scheme 분기·PREF_KEY 저장 존재. [수동] 버튼 순환·새로고침 후 유지.

### 4.10 공유 — 아이폰 메모로 보내기 등 `[필수]`

- 공통 헬퍼 `shareText(title,text)`:
  - `navigator.share` 지원 시 → OS 공유 시트 호출(iOS 사파리=메모/카톡/메일…, 안드로이드=각 기기 메모/킵 등). `AbortError`(사용자 취소)는 조용히 무시.
  - 미지원 시 → `navigator.clipboard.writeText` 폴백(토스트). 그것도 실패 시 → `.txt` 다운로드.
- **메모 탭**: 편집 화면에 `공유` 버튼 → 제목+본문 공유.
- **기록 탭**: 회의록 카드마다 `공유` 버튼(`stopPropagation`) → `who: text` 줄들로 조립해 공유.
- 메모 목록 상단에 "아이폰 메모로 보내기" 사용법 안내문.
- **[알려진 한계/정직 표기]** 저장은 **단방향**(앱 → 아이폰 메모). 아이폰 메모를 앱이 읽어오지 못함(브라우저가 타 앱 데이터 접근 불가).
- 검증: [정적] `navigator.share` 분기 + clipboard 폴백 + AbortError 처리, 메모·카드 공유 핸들러 존재. [수동] iOS에서 공유 시트에 메모 노출.

### 4.11 검색 `[필수]`

- 기록 탭: 검색창(제목+전체 발언 텍스트), 메모 탭: 검색창(제목+본문). 둘 다 **200ms 디바운스**(`debounce` 헬퍼)로 입력마다 전체 재렌더 방지.
- 검증: [정적] 두 검색 핸들러가 debounce 경유, 빈 결과 안내 분기 존재.

### 4.12 OCR — 이미지에서 글자 추출 (온라인 전용·지연 로딩) `[선택]`

메모 편집 화면의 `📷 이미지에서 글자` 버튼. 사진 속 글자를 추출해 본문 커서 위치에 삽입.

- **지연 로딩이 핵심:** Tesseract.js를 초기 HTML에 넣지 않는다. 버튼을 처음 누를 때 `loadTesseract()`가 동적 `<script>`로 `cdn.jsdelivr.net/npm/tesseract.js@5`를 삽입하고, 캐싱(`window.Tesseract`/`tesseractLoading` 프라미스)으로 중복 로드를 막는다. **평소 앱 로딩엔 영향 0.**
- 인식: `createWorker("kor+eng",1,{logger})`로 워커 1회 생성·재사용, `worker.recognize(objectURL)`. 진행률을 `#ocrProgress`에 표시. objectURL은 `revokeObjectURL`로 해제.
- 결과 텍스트는 커서 위치에 삽입 + `memoAutosave()`.
- **[필수] 오프라인 가드:** 버튼 클릭·실행 양쪽에서 `navigator.onLine` 확인, 오프라인이면 토스트 안내 후 중단. 스크립트 로드 실패(`onerror`)도 잡아 "엔진을 불러오지 못했습니다" 안내하고 `tesseractLoading`을 리셋(재시도 가능).
- **[필수] 재진입 가드:** `ocrBusy` 플래그로 처리 중 중복 실행 방지.
- **[알려진 한계/정직 표기]** ① 인터넷 필수(엔진+언어데이터 수~십 MB, 처음 한 번 큰 다운로드) ② 오프라인 불가 ③ 정확도는 사진 품질 의존(깔끔한 인쇄물 양호, 손글씨·기울어진 사진 들쭉날쭉). 이 한계 때문에 **본체 필수 기능이 아닌 `[선택]`** 으로 둔다.
- 검증: [정적] 초기 HTML에 Tesseract script 없음·동적 삽입, onLine 가드 2곳, ocrBusy 가드, 로드 실패 처리, objectURL 해제 존재. [수동] 온라인에서 인쇄물 사진 인식, 오프라인에서 안내.

## 5. 공통 / 횡단 요구사항

- **[필수] XSS 방지:** 모든 사용자 입력(제목·메모·발언자·인식결과)을 DOM에 넣을 때 `esc()`로 `& < >` 이스케이프. `innerHTML`에 raw 사용자 문자열 절대 금지.
  - 검증: 발언자 이름에 `<img src=x onerror=alert(1)>` 넣어도 실행 안 됨.
- **[필수] localStorage 파싱 방어:** `loadDB`/`loadSpk`는 `try/catch`로 손상 데이터 시 기본값 반환.
- **[필수] localStorage 용량 초과(QuotaExceededError):** `saveDB`는 `try/catch`로 감싸 실패 시 토스트("저장공간이 부족합니다…") 안내하고 **boolean 반환**(성공 true / 실패 false). 모든 호출부(저장·가져오기)는 반환값을 확인해, 실패 시 렌더·완료토스트를 건너뛴다.
- **[권장] 접근성:** 키보드 포커스 가시화, `prefers-reduced-motion` 시 애니메이션 제거, 토글에 `<label>` 연결.
- **[필수] 반응형:** 모바일 폭(360px)에서 레이아웃 안 깨짐. `viewport-fit=cover` + safe-area-inset.
- **[권장] PWA 메타:** `apple-mobile-web-app-capable`, `theme-color` 등.

## 6. 디자인 토큰 (그대로 사용 권장)

라이트(`:root`):
```
--ink:#0F1A2E  --ink-2:#1E2D4A  --paper:#F7F4EC  --paper-2:#FFFFFF
--line:#D8D2C2  --accent:#C8553D(녹음/terracotta)  --accent-2:#2E7D6B(액션/teal)
--gold:#B8860B  --muted:#6B7280
```
다크(`html[data-theme="dark"]`):
```
--ink:#E8E6E0 --ink-2:#C7CBD4 --paper:#15171C --paper-2:#1F232B
--line:#343A45 --accent:#E07A5F --accent-2:#5FB89E --muted:#8B94A3
```
글꼴: `--app-font`(사용자 선택: 손글씨 Nanum Pen Script / 고딕 시스템sans / 명조 Nanum Myeongjo), `--fs`(글자크기 15~21px), mono: SF Mono 계열(시간/숫자). 브랜드·카드 제목은 `--app-font` 적용.
녹음 중 펄스 애니메이션, 토스트(하단 중앙), 카드 그림자.

## 7. 적대적 검토 체크리스트 (구현 후 전부 통과해야 함)

> `[정적]` = Claude Code가 코드 읽고 반드시 검증. `[수동]` = 코드에 로직 존재만 정적 확인하고, 실제 동작은 사람이 테스트(거짓 통과 보고 금지).

마이크/권한
- [ ] [수동] 마이크 거부 → 앱 생존 + 안내  ※코드상 `not-allowed` 분기 존재는 [정적]
- [ ] [수동] 권한 후 30초 침묵 → 인식 유지  ※`onend` 자동재시작 로직 존재는 [정적]
- [ ] [정적] 중지 버튼 → `restartGuard`로 재시작 루프 차단
- [ ] [정적] 미지원 브라우저 → 녹음만 비활성, 나머지 동작(`if(!SR)` 분기)
- [ ] [정적] 탭 전환 시 `stopAllStt()`로 녹음·검토·메모 STT 전부 중지(엔진 충돌·마이크 점유 방지)

Wake Lock
- [ ] [수동] 기본 ON, 녹음 시 화면 안 꺼짐  ※토글 기본 checked + request 호출은 [정적]
- [ ] [정적] `visibilitychange`에서 `recognizing`이면 재요청
- [ ] [정적] `request`/`release`가 `try/catch`로 미지원 시 안전
- [ ] [정적] UI에 "전원버튼/강제절전은 못 막음" 문구 존재

검토 탭
- [ ] [정적] 단축키 핸들러에 INPUT 제외 + 탭 active + 스테이지 표시 가드
- [ ] [정적] `Space` `preventDefault()` 존재
- [ ] [수동] 구간 탭 → 정확한 시점 점프  ※`currentTime=audioTime` 할당은 [정적]
- [ ] [정적] 새 파일 로드 시 이전 objectURL `revokeObjectURL`
- [ ] [정적] 저장 시 `audioTime*1000` 변환

데이터/저장
- [ ] [수동] 녹음·검토 양쪽 저장본 타임스탬프 정상  ※변환 코드는 [정적]
- [ ] [정적] `loadDB`/`loadSpk` `try/catch`로 손상 데이터 복구
- [ ] [정적] `saveDB`/`saveFolders`/`saveMemos` `try/catch` + boolean 반환 + 토스트
- [ ] [정적] 삭제 ×에 `stopPropagation`
- [ ] [정적] 재저장 갱신: `loadedMeetingId` 분기로 불러온 회의 in-place 갱신(중복 방지), `새로`에서 리셋
- [ ] [정적] 가져오기: validMeeting/메모 타입검사 + 회의·폴더·메모 각 id 중복 병합 + folderId 보존 + `input.value=""`
- [ ] [정적] 가져오기: 구·신·단건 형식 모두 허용, JSON 파싱 try/catch, save 반환 확인 후 렌더

폴더/메모
- [ ] [정적] 폴더 CRUD(생성/이름변경/삭제→미분류 이동) + 칩 필터 + 카드 이동
- [ ] [정적] 활성 폴더 선택 시 신규 저장이 그 폴더에 배치
- [ ] [정적] 메모 자동저장 디바운스 + 빈 메모 자동정리
- [ ] [정적] 메모 STT 별도 인스턴스 + interim 미리보기 + 확정분만 커서 삽입
- [ ] [정적] TTS 흔적 0건(`speechSynthesis`/`speak`/`synth` 없음)

설정/공유/검색
- [ ] [정적] 글꼴 3종(hand/gothic/myeongjo) data-font 프리셋 + 손글씨 외 제목 보정
- [ ] [정적] 글자크기 FONT_STEPS 순환·--fs 갱신, 다크모드 토큰·theme-color, prefers-color-scheme 자동
- [ ] [정적] prefs(theme/fontIdx/fontFace) PREF_KEY 저장·로드 즉시 적용
- [ ] [정적] `shareText`: navigator.share + clipboard 폴백 + AbortError 무시
- [ ] [정적] 메모·기록카드 공유 핸들러(stopPropagation)
- [ ] [정적] 기록·메모 검색 200ms 디바운스 + 빈결과 안내
- [ ] [정적] OCR: 초기 HTML에 Tesseract script 없음(지연 로딩), onLine 가드 2곳, ocrBusy 재진입 가드, 로드실패 처리·tesseractLoading 리셋, objectURL 해제

보안/안정성
- [ ] [정적] 발언자/메모/제목/인식결과 모두 `esc()` 통과(raw innerHTML 없음)
- [ ] [정적] 외부 `<script src>`(정적) 0건·`fetch`/`XHR` 0건. 정적 `<link href>`는 구글폰트 2건만. Tesseract는 OCR 클릭 시에만 동적 삽입(예외)
- [ ] [수동] 폰트 CDN 차단/오프라인에서도 기능 정상(글꼴만 fallback)
- [ ] [수동] file:// 로 열어 동작(인식·글꼴모양 제외)
- [ ] [수동] 360px 모바일 레이아웃 정상(라이트·다크 모두)
- [ ] [정적/수동] JS 콘솔 에러 0 (정적 문법검사 + 수동 실행)

요약/할일
- [ ] [정적] 빈/짧은 입력 분기 존재(크래시 없음)
- [ ] [정적] `activeSegments()` 우선순위·`typeof` 가드 존재
- [ ] [정적] 요약: 길이가중 키워드·위치가중·jaccard 중복제거 존재
- [ ] [정적] 할일: STRONG/WEAK 구분·DUE 추출·strong 우선정렬 존재
- [ ] [수동] 키워드/액션 정규식 한국어 매칭 품질

**정적 검사 보조:** 단일 HTML이라도 `<script>` 본문을 추출해 Node로 `new Function(js)` 문법검사, 괄호/중괄호 균형, 외부 요청 grep 등을 수행해 [정적] 항목을 기계적으로 확인할 것.

## 8. 산출물

- `meetnote.html` 1개 파일.
- 구현 완료 시 7장 체크리스트 결과를 함께 보고.
- 임의로 외부 라이브러리 추가, 서버 도입, 기능 축소 금지. 변경이 필요하면 먼저 질문.

## 9. 부록 — 현재 meetnote.html에 대한 사전 적대적 검토 결과

경로 B로 진행할 때 참고. 작성자가 현재 코드를 검토한 결과, 아래는 **이미 통과**하므로 건드리지 말 것:

- XSS: 발언자·메모·제목·인식결과 `esc()` 통과, `audioName`은 `textContent`. (안전)
- localStorage 읽기/쓰기: load 계열 `try/catch`, save 계열(`saveDB`/`saveFolders`/`saveMemos`) `try/catch`+boolean. (안전)
- 음성인식: 자동재시작·`restartGuard`·`onerror` 분기·`start()` try/catch. (안전)
- **STT 엔진 충돌: 탭 전환 시 `stopAllStt()`로 전부 중지.** (안전)
- 단축키 가드, `Space` preventDefault, audioTime→ts 변환, objectURL 해제. (안전)
- **재저장: `loadedMeetingId`로 불러온 회의 in-place 갱신(중복 방지), 폴더 유지.** (안전)
- 가져오기: 형식 하위호환(구 배열/신 객체/단건), 회의·폴더·메모 3종 id 중복 병합, folderId 보존, input 초기화. (안전)
- 메모: 디바운스 자동저장, 빈 메모 정리, STT interim 미리보기 + 확정분만 삽입. (안전)
- **TTS: 완전 제거됨**(`speechSynthesis`/`speak`/`synth` 0건). 재추가 금지(질문 우선). (안전)
- 설정: 글꼴3종/글자크기/다크모드 prefs 저장, prefers-color-scheme 자동, 폰트 fallback 체인. (안전)
- 공유: `shareText` navigator.share + clipboard/다운로드 폴백, AbortError 무시. (안전)
- 검색: 기록·메모 200ms 디바운스. (안전)
- OCR: 지연 로딩(초기 영향 0)·onLine 가드·ocrBusy·로드실패 처리·objectURL 해제. 온라인 전용 [선택] 기능. (안전)
- 외부요청: 구글폰트 CSS 2건(상시) + Tesseract(OCR 클릭 시 동적), fetch/XHR/정적 외부script 0건. (안전)

**과거 검토에서 지적된 결함은 모두 수정 완료:**
1. ~~objectURL 누수~~ ✅  2. ~~QuotaExceeded 미처리~~ ✅  3. ~~STT 동시 충돌~~ ✅  4. ~~불러온 회의 재저장 중복~~ ✅  5. ~~메모 백업 누락~~ ✅  6. ~~TTS 음성 되받아쓰기/15초 끊김/getVoices~~ ✅(TTS 제거)  7. ~~메모 STT 무피드백~~ ✅(미리보기 추가)

현재 코드에서 [정적] 통과를 다시 독립 검증할 것. (작성자 검토가 완전하다고 가정하지 말 것 — 그게 적대적 검토의 핵심이다.)
