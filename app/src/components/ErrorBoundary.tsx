import { Component, type ErrorInfo, type ReactNode } from 'react';

// 런타임 예외로 흰 화면이 되는 대신 복구 안내를 표시한다.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('MeetNote crashed:', error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center bg-bg">
        <p className="text-fg font-semibold">문제가 발생했어요</p>
        <p className="text-sm text-muted">저장된 회의록은 안전합니다. 앱을 다시 불러오면 복구됩니다.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-primary text-white text-sm font-semibold px-6 py-2.5"
        >
          다시 불러오기
        </button>
      </div>
    );
  }
}
