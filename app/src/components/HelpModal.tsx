import { useState } from 'react';
import { ChevronRight, X, Mic, Library, CalendarDays, Settings, FileText, Sparkles, Share2 } from 'lucide-react';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'record',
    title: '🎙️ 녹음하기',
    icon: <Mic size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>마이크로 회의, 강의, 인터뷰를 녹음합니다.</p>
        <div className="space-y-2">
          <p className="font-semibold">📌 시작하기</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>제목 입력 (예: "2월 기획회의")</li>
            <li>발언자 추가 (선택)</li>
            <li>🎤 버튼 → 녹음 시작</li>
            <li>말하기 → 실시간 자막 표시</li>
            <li>⏹ 저장 → 회의록 저장</li>
          </ol>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">⚙️ 고급 옵션</p>
          <ul className="space-y-1 text-xs">
            <li>• <strong>언어</strong>: 한국어, 영어, 일본어 등</li>
            <li>• <strong>노이즈 감소</strong>: 주변음 필터링</li>
          </ul>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">🎤 오디오 소스</p>
          <div className="space-y-1.5 text-xs">
            <div className="p-2 rounded bg-divider/20">
              <p><strong>마이크 (기본)</strong><br/>일반 회의·인터뷰·강의 녹음</p>
            </div>
            <div className="p-2 rounded bg-divider/20">
              <p><strong>시스템 (데스크탑만)</strong><br/>컴퓨터에서 나오는 모든 소리 (YouTube, 회의앱 오디오)</p>
            </div>
            <div className="p-2 rounded bg-divider/20">
              <p><strong>둘 다 (데스크탑만)</strong><br/>마이크 + 시스템 오디오 함께 녹음</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">💡 팁</p>
          <ul className="space-y-1 text-xs">
            <li>• TV 뉴스: "오디오 소스 → 시스템" 선택</li>
            <li>• 일시정지했다가 계속 가능</li>
            <li>• 데스크탑 Chrome만 시스템 오디오 지원</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'ios-import',
    title: '📱 iOS 음성 메모 가져오기',
    icon: <FileText size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>iPhone의 음성 메모를 MeetNote로 가져옵니다.</p>
        <div className="space-y-2">
          <p className="font-semibold">📲 가져오기 방법</p>
          <ol className="list-decimal list-inside space-y-2 text-xs">
            <li>iPhone 음성 메모 앱 열기</li>
            <li>가져올 음성 메모 선택</li>
            <li>공유 버튼 (↗) 탭</li>
            <li>"MeetNote" 선택</li>
            <li>자동으로 기록에 추가됨</li>
          </ol>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">💡 팁</p>
          <ul className="space-y-1 text-xs">
            <li>• 첫 사용 시 "MeetNote"가 나타나지 않으면, 공유 옵션에서 찾기</li>
            <li>• 한 번에 여러 파일 가져오기 가능</li>
            <li>• 가져온 파일의 제목을 수정할 수 있음</li>
            <li>• 오디오는 기기에만 저장됨 (클라우드 옵션)</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'transcribe',
    title: '✨ 자동 전사 (STT)',
    icon: <FileText size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>녹음을 자동으로 텍스트로 변환합니다.</p>
        <div className="space-y-2">
          <p className="font-semibold">3가지 방식</p>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded border border-divider">
              <p className="font-semibold text-primary">1️⃣ 온디바이스 (기본)</p>
              <p className="text-muted">무료, 로컬 처리, 인터넷 불필요<br/>첫 사용 시 모델 다운로드(~500MB)</p>
            </div>
            <div className="p-2 rounded border border-divider">
              <p className="font-semibold text-primary">2️⃣ Groq (클라우드)</p>
              <p className="text-muted">설정 → AI 키에 Groq API 키 입력<br/>빠르고 정확</p>
            </div>
            <div className="p-2 rounded border border-divider">
              <p className="font-semibold text-primary">3️⃣ AssemblyAI (화자 분리)</p>
              <p className="text-muted">다인 회의 → "누가 말했는지" 분석<br/>API 키 입력 필수</p>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-divider text-xs">
          <p className="font-semibold mb-1">시작 방법</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>회의록 열기</li>
            <li>"자동 전사" 버튼 클릭</li>
            <li>완료 기다림 (길이에 따라 수 초~수 분)</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: 'note',
    title: '📝 노트 편집',
    icon: <FileText size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>툴바 버튼으로 손쉽게 서식을 넣을 수 있습니다. 글자를 선택한 뒤 버튼을 누르면 선택 영역에 적용되고, 선택 없이 누르면 예시 글자가 들어갑니다.</p>

        <div className="space-y-2">
          <p className="font-semibold">글자 꾸미기</p>
          <div className="space-y-1 text-xs bg-divider/30 p-2 rounded">
            <p><strong>H</strong> 제목 → <code># 제목</code></p>
            <p><strong>B</strong> 굵게 → <code>**굵은 글자**</code></p>
            <p><strong>I</strong> 기울임 → <code>_기울임_</code></p>
            <p><strong>U</strong> 밑줄 → <code>__밑줄__</code></p>
            <p><strong>S</strong> 취소선 → <code>~~취소선~~</code></p>
            <p><strong>🔗</strong> 링크 → <code>[링크](url)</code></p>
            <p><strong>{'</>'}</strong> 코드 → <code>`코드`</code></p>
            <p><strong>"</strong> 인용문 → <code>&gt; 인용</code></p>
            <p><strong>—</strong> 구분선 → <code>---</code> (가로줄)</p>
          </div>
          <p className="text-xs text-muted">같은 버튼을 다시 누르면 제목·인용·목록 서식은 해제됩니다(토글).</p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">목록</p>
          <div className="space-y-1 text-xs">
            <p>• 글머리: <code>- 항목</code> + Enter</p>
            <p>• 번호: <code>1. 항목</code> + Enter (자동 증가)</p>
            <p>• 체크: <code>- [ ] 할 일</code> (미리보기에서 클릭 체크)</p>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">⚠️ 강조 박스 (! 버튼)</p>
          <p className="text-xs text-muted">! 버튼을 누르면 4가지 색상 박스를 고를 수 있습니다. 항상 새 줄에 삽입돼요.</p>
          <div className="space-y-1.5 text-xs">
            <div className="px-2 py-1.5 rounded border-l-4 border-blue-400 bg-blue-50 text-blue-900">ℹ️ <strong>참고</strong> — 부가 정보</div>
            <div className="px-2 py-1.5 rounded border-l-4 border-green-400 bg-green-50 text-green-900">💡 <strong>팁</strong> — 유용한 요령</div>
            <div className="px-2 py-1.5 rounded border-l-4 border-orange-400 bg-orange-50 text-orange-900">⚠️ <strong>주의</strong> — 조심할 점</div>
            <div className="px-2 py-1.5 rounded border-l-4 border-red-400 bg-red-50 text-red-900">🚨 <strong>경고</strong> — 중요 경고</div>
          </div>
        </div>

        <div className="pt-2 border-t border-divider">
          <p className="font-semibold text-xs mb-2">💡 자동 기능</p>
          <ul className="text-xs space-y-1">
            <li>• Enter: 목록·번호·체크 자동 계속 (번호는 자동 증가)</li>
            <li>• 빈 목록 줄에서 Enter: 목록 종료</li>
            <li>• Tab / Shift+Tab: 들여쓰기 / 내어쓰기</li>
            <li>• 👁 미리보기: 서식이 적용된 최종 모습 확인</li>
            <li>• 삽입은 항상 커서 위치에 — 다른 곳으로 튀지 않아요</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'ai',
    title: '🤖 AI 요약',
    icon: <Sparkles size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>AI가 회의록을 자동으로 정리합니다.</p>
        <div className="space-y-2">
          <p className="font-semibold">준비 단계</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>설정 → AI 키에 Gemini 또는 Groq 키 입력</li>
            <li>회의록이 전사되어 있어야 함</li>
          </ol>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">사용 방법</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>회의록 → "요약" 탭</li>
            <li>"AI로 요약 생성" 버튼</li>
            <li>완료 → 핵심·결정·할 일 자동 추출</li>
          </ol>
        </div>
        <div className="pt-2 border-t border-divider">
          <p className="font-semibold text-xs mb-2">📊 생성 항목</p>
          <ul className="text-xs space-y-1">
            <li>• 요약 (TLDR)</li>
            <li>• 핵심 논의 내용</li>
            <li>• 결정 사항</li>
            <li>• 할 일 & 담당자</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'library',
    title: '📚 기록 (라이브러리)',
    icon: <Library size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>저장된 모든 회의록을 관리합니다.</p>
        <div className="space-y-2">
          <p className="font-semibold">폴더 관리</p>
          <ul className="text-xs space-y-1">
            <li>• "모든 노트": 전체 회의록</li>
            <li>• 폴더: 프로젝트/주제별로 그룹화</li>
            <li>• "+ 새 폴더": 폴더 생성</li>
            <li>• "순서 편집": ⠿ 손잡이를 드래그해 폴더 순서 변경</li>
          </ul>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">검색 & 정렬</p>
          <ul className="text-xs space-y-1">
            <li>• 🔍 검색: 제목, 전사 내용 검색</li>
            <li>• 📅 달력: 날짜별 필터링</li>
            <li>• 정렬: 최신순 / 오래된순 / 길이순</li>
          </ul>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">템플릿</p>
          <p className="text-xs text-muted">새 노트 만들 때 선택:<br/>빈 노트 · 회의록 · 할 일 · 인터뷰 · 회고 등</p>
        </div>
      </div>
    ),
  },
  {
    id: 'calendar',
    title: '📅 달력',
    icon: <CalendarDays size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>날짜별로 회의록을 확인합니다.</p>
        <div className="space-y-2">
          <p className="font-semibold">사용 방법</p>
          <ul className="text-xs space-y-1">
            <li>• 월 달력 표시: 기록 있는 날에 파란 점</li>
            <li>• 날짜 탭: 그날 회의록 목록 표시</li>
            <li>• 오늘 강조: 회색 테두리</li>
          </ul>
        </div>
        <div className="pt-2 border-t border-divider">
          <p className="font-semibold text-xs mb-2">💡 네비게이션</p>
          <ul className="text-xs space-y-1">
            <li>• ◀️ / ▶️: 이전/다음 달</li>
            <li>• 좌우 드래그: 월 이동</li>
            <li>• 날짜 클릭: 상세 목록</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'export',
    title: '💾 내보내기 & 공유',
    icon: <Share2 size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>회의록을 여러 형식으로 내보내고 공유합니다.</p>
        <div className="space-y-2">
          <p className="font-semibold">포맷</p>
          <ul className="text-xs space-y-1">
            <li>• <strong>TXT</strong>: 평문</li>
            <li>• <strong>MD</strong>: 마크다운 (다른 도구에서 편집 가능)</li>
            <li>• <strong>JSON</strong>: 데이터 내보내기</li>
            <li>• <strong>오디오</strong>: 원본 녹음 파일</li>
          </ul>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">공유 방법</p>
          <ul className="text-xs space-y-1">
            <li>• <strong>복사</strong>: 클립보드로 복사</li>
            <li>• <strong>공유</strong>: 기기의 공유 기능</li>
            <li>• <strong>링크</strong>: GitHub Gist 공유 링크 생성</li>
            <li>• <strong>인쇄</strong>: PDF로 인쇄</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'settings',
    title: '⚙️ 설정',
    icon: <Settings size={20} />,
    content: (
      <div className="space-y-3 text-sm">
        <p>앱 설정과 API 키를 관리합니다.</p>
        <div className="space-y-2">
          <p className="font-semibold">STT (음성 인식)</p>
          <ul className="text-xs space-y-1">
            <li>• 기본 언어 선택</li>
            <li>• 노이즈 감소 ON/OFF</li>
            <li>• 화자 분리 (AssemblyAI)</li>
          </ul>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">AI & 클라우드</p>
          <ul className="text-xs space-y-1">
            <li>• AI 프로바이더: Gemini / Groq 선택</li>
            <li>• API 키 입력 (설정 후 저장됨)</li>
            <li>• Supabase 클라우드 동기화</li>
          </ul>
        </div>
        <div className="space-y-2 pt-2 border-t border-divider">
          <p className="font-semibold">데이터</p>
          <ul className="text-xs space-y-1">
            <li>• 모든 데이터는 기기에 로컬 저장</li>
            <li>• 클라우드 옵션: 선택 사항</li>
            <li>• 개인정보 보호: 서버에 보내지 않음</li>
          </ul>
        </div>
      </div>
    ),
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: Props): JSX.Element | null {
  const [selected, setSelected] = useState<string | null>(null);

  if (!isOpen) return null;

  const section = HELP_SECTIONS.find((s) => s.id === selected);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl max-w-lg w-full shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-divider">
          <h2 className="text-lg font-bold text-fg">
            {section ? section.title : '도움말'}
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center text-muted"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!section ? (
            /* 메뉴 */
            <div className="divide-y divide-divider">
              {HELP_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-divider/30 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-lg">{s.title}</div>
                  </div>
                  <ChevronRight size={18} className="text-muted" />
                </button>
              ))}
            </div>
          ) : (
            /* 상세 내용 */
            <div className="px-4 py-4">{section.content}</div>
          )}
        </div>

        {/* 푸터 */}
        {section && (
          <div className="flex-none px-4 py-3 border-t border-divider">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="w-full py-2 rounded-full border border-divider text-muted text-sm font-medium"
            >
              뒤로
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
