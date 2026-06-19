import { useRef, useState } from 'react';
import { Bold, Italic, List, CheckSquare, Eye, EyeOff, ListOrdered, Minus, Strikethrough, Quote, Code2, Link2, Underline } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}

// ─── 마크다운 렌더러 ──────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|_[^_\n]+_|\*[^*\n]+\*|~~[^~\n]+~~|`[^`\n]+`|\[([^\]]+)\]\(([^)]+)\))/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (/^\*\*[^*\n]+\*\*$/.test(part) || /^__[^_\n]+__$/.test(part))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^_[^_\n]+_$/.test(part) || /^\*[^*\n]+\*$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^~~[^~\n]+~~$/.test(part))
      return <del key={i} className="opacity-60">{part.slice(2, -2)}</del>;
    if (/^`[^`\n]+`$/.test(part))
      return <code key={i} className="bg-divider/40 px-1 rounded text-xs">{part.slice(1, -1)}</code>;
    if (/^\[([^\]]+)\]\(([^)]+)\)$/.test(part)) {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) return <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline">{m[1]}</a>;
    }
    return part;
  });
}

function MarkdownPreview({
  text,
  onToggle,
}: {
  text: string;
  onToggle: (lineIdx: number) => void;
}) {
  if (!text.trim()) return null;

  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listBuf: React.ReactNode[] = [];
  let listKind: 'ul' | 'ol' | null = null;

  const flush = (key: string) => {
    if (!listBuf.length) return;
    const cls = 'my-1 space-y-0.5';
    nodes.push(
      listKind === 'ol'
        ? <ol key={key} className={`${cls} list-decimal pl-5`}>{listBuf}</ol>
        : <ul key={key} className={`${cls} pl-1`}>{listBuf}</ul>,
    );
    listBuf = [];
    listKind = null;
  };

  lines.forEach((line, idx) => {
    // Admonition (주의/팁/참고)
    const admon = line.match(/^> \[!(NOTE|TIP|CAUTION|WARNING|INFO)\]\s+(.*)/i);
    if (admon) {
      flush(`pre${idx}`);
      const type = admon[1].toUpperCase();
      const text = admon[2];
      const colors: Record<string, string> = {
        NOTE: 'border-blue-400 bg-blue-50 text-blue-900',
        TIP: 'border-green-400 bg-green-50 text-green-900',
        CAUTION: 'border-orange-400 bg-orange-50 text-orange-900',
        WARNING: 'border-red-400 bg-red-50 text-red-900',
        INFO: 'border-cyan-400 bg-cyan-50 text-cyan-900',
      };
      const typeLabels: Record<string, string> = { NOTE: '참고', TIP: '팁', CAUTION: '주의', WARNING: '경고', INFO: '정보' };
      nodes.push(
        <div key={idx} className={`border-l-4 rounded px-3 py-2 my-2 text-sm ${colors[type] || colors.NOTE}`}>
          <p className="font-semibold text-xs mb-1">{typeLabels[type]}</p>
          <p className="leading-relaxed">{renderInline(text)}</p>
        </div>,
      );
      return;
    }

    // 체크리스트
    const chk = line.match(/^(\s*)([-*] \[([ xX])\] )(.*)/);
    if (chk) {
      const done = chk[3].toLowerCase() === 'x';
      if (listKind !== 'ul') flush(`pre${idx}`);
      listKind = 'ul';
      listBuf.push(
        <li key={idx} className="flex items-start gap-2 list-none" style={{ paddingLeft: chk[1].length * 8 }}>
          <input
            type="checkbox"
            checked={done}
            onChange={() => onToggle(idx)}
            className="mt-[3px] accent-primary flex-none cursor-pointer"
          />
          <span className={done ? 'line-through text-muted' : ''}>{renderInline(chk[4])}</span>
        </li>,
      );
      return;
    }

    // 글머리 기호
    const ul = line.match(/^(\s*)([-*+] )(.*)/);
    if (ul) {
      if (listKind !== 'ul') flush(`pre${idx}`);
      listKind = 'ul';
      listBuf.push(
        <li key={idx} className="ml-4" style={{ paddingLeft: ul[1].length * 8 }}>
          {renderInline(ul[3])}
        </li>,
      );
      return;
    }

    // 번호 목록
    const ol = line.match(/^(\s*)(\d+)\. (.*)/);
    if (ol) {
      if (listKind !== 'ol') flush(`pre${idx}`);
      listKind = 'ol';
      listBuf.push(<li key={idx}>{renderInline(ol[3])}</li>);
      return;
    }

    flush(`pre${idx}`);

    // 제목
    const h3 = line.match(/^### (.*)/);
    const h2 = line.match(/^## (.*)/);
    const h1 = line.match(/^# (.*)/);
    if (h1) { nodes.push(<h2 key={idx} className="text-xl font-bold mt-4 mb-1 text-fg">{renderInline(h1[1])}</h2>); return; }
    if (h2) { nodes.push(<h3 key={idx} className="text-base font-bold mt-3 mb-0.5 text-fg">{renderInline(h2[1])}</h3>); return; }
    if (h3) { nodes.push(<h4 key={idx} className="text-sm font-semibold mt-2 mb-0.5 text-fg">{renderInline(h3[1])}</h4>); return; }

    // 인용문
    const quote = line.match(/^> (.*)/);
    if (quote) {
      flush(`pre${idx}`);
      nodes.push(
        <blockquote key={idx} className="border-l-4 border-primary/40 pl-3 py-1 text-sm italic text-muted">
          {renderInline(quote[1])}
        </blockquote>
      );
      return;
    }

    // 코드 블록 (단일 줄)
    if (line.startsWith('```') && line.endsWith('```') && line.length > 6) {
      flush(`pre${idx}`);
      const code = line.slice(3, -3);
      nodes.push(
        <pre key={idx} className="bg-divider/30 rounded p-2 text-xs overflow-x-auto my-2">
          <code>{code}</code>
        </pre>
      );
      return;
    }

    // 구분선
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={idx} className="border-divider my-3" />);
      return;
    }

    // 빈 줄
    if (!line.trim()) {
      nodes.push(<div key={idx} className="h-2" />);
      return;
    }

    nodes.push(<p key={idx} className="leading-relaxed">{renderInline(line)}</p>);
  });

  flush('end');
  return <>{nodes}</>;
}

// ─── 편집 헬퍼 ───────────────────────────────────────────────────────────────

// setRangeText로 [start,end] 범위만 정확히 교체한다. 네이티브 API라
// 커서가 자동 처리되고, onChange(el.value)로 React state를 DOM과 일치시키면
// 리렌더 시 value===el.value 이므로 React가 커서를 건드리지 않는다.
// → "다른 곳 삽입 / 아래 내용 삭제" 경합 조건이 원천 제거됨.

function wrapSelection(
  el: HTMLTextAreaElement,
  pre: string,
  post: string,
  fallback: string,
  onChange: (v: string) => void,
) {
  const s = el.selectionStart;
  const e = el.selectionEnd;
  const sel = el.value.slice(s, e) || fallback;
  el.focus();
  el.setRangeText(pre + sel + post, s, e, 'end');
  // 안쪽 텍스트(placeholder)를 선택해 바로 덮어쓸 수 있게 한다
  el.setSelectionRange(s + pre.length, s + pre.length + sel.length);
  onChange(el.value);
}

function prefixLine(
  el: HTMLTextAreaElement,
  prefix: string,
  onChange: (v: string) => void,
) {
  const v = el.value;
  const s = el.selectionStart;
  const lineStart = v.lastIndexOf('\n', s - 1) + 1;
  const lineEnd = v.indexOf('\n', s);
  const end = lineEnd < 0 ? v.length : lineEnd;
  const line = v.slice(lineStart, end);

  el.focus();
  if (line.startsWith(prefix)) {
    // 토글: 접두사 제거
    el.setRangeText('', lineStart, lineStart + prefix.length, 'end');
    const cur = Math.max(lineStart, s - prefix.length);
    el.setSelectionRange(cur, cur);
  } else {
    el.setRangeText(prefix, lineStart, lineStart, 'end');
    const cur = s + prefix.length;
    el.setSelectionRange(cur, cur);
  }
  onChange(el.value);
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

const ADMONITIONS = [
  { type: 'NOTE', label: '참고', icon: 'ℹ️' },
  { type: 'TIP', label: '팁', icon: '💡' },
  { type: 'CAUTION', label: '주의', icon: '⚠️' },
  { type: 'WARNING', label: '경고', icon: '🚨' },
];

export default function NoteEditor({ value, onChange, onBlur, placeholder }: Props) {
  const [preview, setPreview] = useState(false);
  const [showAdmon, setShowAdmon] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (pre: string, post: string, fallback: string) => {
    if (ref.current) wrapSelection(ref.current, pre, post, fallback, onChange);
  };
  const prefix = (p: string) => {
    if (ref.current) prefixLine(ref.current, p, onChange);
  };
  const addAdmonition = (type: string) => {
    const el = ref.current;
    if (!el) return;
    const v = el.value;
    const s = el.selectionStart;

    // 현재 커서가 있는 라인의 범위
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    const lineEnd = v.indexOf('\n', s);
    const end = lineEnd < 0 ? v.length : lineEnd;
    const line = v.slice(lineStart, end);
    const ins = `> [!${type}] `;

    el.focus();
    if (!line.trim()) {
      // 빈 줄 → 그 줄을 그대로 교체
      el.setRangeText(ins, lineStart, end, 'end');
    } else {
      // 내용 있는 줄 → 줄 끝에 새 줄로 삽입 (아래 내용은 그대로 보존)
      el.setRangeText('\n' + ins, end, end, 'end');
    }
    onChange(el.value);
    setShowAdmon(false);
  };

  const toggleCheck = (lineIdx: number) => {
    const lines = value.split('\n');
    const line = lines[lineIdx];
    const wasUnchecked = /\[ \]/.test(line);
    lines[lineIdx] = wasUnchecked
      ? line.replace('[ ]', '[x]')
      : line.replace(/\[x\]/i, '[ ]');
    onChange(lines.join('\n'));
  };

  // 자동 들여쓰기 / 자동 일련번호
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;

    const v = el.value;

    // Tab: 들여쓰기 / 내어쓰기
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = el.selectionStart;
      const lineStart = v.lastIndexOf('\n', s - 1) + 1;
      const line = v.slice(lineStart, v.indexOf('\n', s) < 0 ? v.length : v.indexOf('\n', s));

      if (e.shiftKey) {
        if (line.startsWith('  ')) {
          el.setRangeText('', lineStart, lineStart + 2, 'end');
          const cur = Math.max(lineStart, s - 2);
          el.setSelectionRange(cur, cur);
          onChange(el.value);
        }
      } else {
        el.setRangeText('  ', lineStart, lineStart, 'end');
        el.setSelectionRange(s + 2, s + 2);
        onChange(el.value);
      }
      return;
    }

    // Enter: 목록 자동 계속
    if (e.key === 'Enter') {
      const s = el.selectionStart;
      const lineStart = v.lastIndexOf('\n', s - 1) + 1;
      const line = v.slice(lineStart, s);

      // 빈 목록 줄 → 목록 종료
      if (/^(\s*)([-*] \[[ x]\] |[-*+] |\d+\. )$/.test(line)) {
        e.preventDefault();
        el.setRangeText('\n', lineStart, lineStart + line.length, 'end');
        el.setSelectionRange(lineStart + 1, lineStart + 1);
        onChange(el.value);
        return;
      }

      // 체크리스트 계속
      const chk = line.match(/^(\s*)([-*] \[[ x]\] )(.*)/);
      if (chk && chk[3].trim()) {
        e.preventDefault();
        el.setRangeText('\n' + chk[1] + '- [ ] ', s, s, 'end');
        onChange(el.value);
        return;
      }

      // 글머리 기호 계속
      const ul = line.match(/^(\s*)([-*+] )(.*)/);
      if (ul && ul[3].trim()) {
        e.preventDefault();
        el.setRangeText('\n' + ul[1] + ul[2], s, s, 'end');
        onChange(el.value);
        return;
      }

      // 번호 목록 계속
      const ol = line.match(/^(\s*)(\d+)\. (.*)/);
      if (ol && ol[3].trim()) {
        e.preventDefault();
        el.setRangeText('\n' + ol[1] + (parseInt(ol[2]) + 1) + '. ', s, s, 'end');
        onChange(el.value);
        return;
      }
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* 툴바 */}
      <div className="flex items-center gap-0.5 pb-1 border-b border-divider/60">
        <TB label="제목" onClick={() => prefix('# ')}>
          <span className="text-[13px] font-extrabold leading-none">H</span>
        </TB>
        <TB label="굵게" onClick={() => wrap('**', '**', '굵은 글자')}>
          <Bold size={14} strokeWidth={2.5} />
        </TB>
        <TB label="기울임" onClick={() => wrap('_', '_', '기울임')}>
          <Italic size={14} />
        </TB>
        <TB label="밑줄" onClick={() => wrap('__', '__', '밑줄')}>
          <Underline size={14} />
        </TB>
        <TB label="취소선" onClick={() => wrap('~~', '~~', '취소선')}>
          <Strikethrough size={14} />
        </TB>
        <TB label="링크" onClick={() => wrap('[', '](url)', '링크')}>
          <Link2 size={14} />
        </TB>
        <TB label="코드" onClick={() => wrap('`', '`', '코드')}>
          <Code2 size={14} />
        </TB>
        <TB label="인용문" onClick={() => prefix('> ')}>
          <Quote size={14} />
        </TB>
        <div className="relative">
          <TB label="주의/팁" onClick={() => setShowAdmon(!showAdmon)}>
            <span className="text-xs font-bold">!</span>
          </TB>
          {showAdmon && (
            <div className="absolute top-full mt-1 left-0 bg-surface border border-divider rounded-lg shadow-lg z-10 py-1 min-w-max">
              {ADMONITIONS.map((a) => (
                <button
                  key={a.type}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addAdmonition(a.type)}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-divider/50 text-fg flex items-center gap-2"
                >
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-4 bg-divider mx-0.5" />
        <TB label="글머리" onClick={() => prefix('- ')}>
          <List size={14} />
        </TB>
        <TB label="번호 목록" onClick={() => prefix('1. ')}>
          <ListOrdered size={14} />
        </TB>
        <TB label="체크리스트" onClick={() => prefix('- [ ] ')}>
          <CheckSquare size={14} />
        </TB>
        <TB label="구분선" onClick={() => {
          const el = ref.current;
          if (!el) return;
          el.focus();
          el.setRangeText('\n---\n', el.selectionStart, el.selectionEnd, 'end');
          onChange(el.value);
        }}>
          <Minus size={14} />
        </TB>
        <button
          type="button"
          aria-label={preview ? '편집 모드' : '미리보기'}
          title={preview ? '편집 모드' : '미리보기'}
          onClick={() => setPreview((v) => !v)}
          className={`ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ${
            preview
              ? 'bg-primary text-white border-primary'
              : 'border-divider text-muted'
          }`}
        >
          {preview ? <><EyeOff size={12} /> 편집</> : <><Eye size={12} /> 미리보기</>}
        </button>
      </div>

      {/* 본문 */}
      {preview ? (
        <div className="text-sm text-fg leading-relaxed min-h-[200px]">
          {value.trim() ? (
            <MarkdownPreview text={value} onToggle={toggleCheck} />
          ) : (
            <p className="text-muted italic">{placeholder ?? '내용이 없습니다.'}</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="회의 메모"
          spellCheck={false}
          className="w-full min-h-[200px] bg-transparent text-fg text-sm outline-none resize-none leading-relaxed"
        />
      )}
    </div>
  );
}

function TB({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // mousedown/touch 시 기본동작(포커스 이동)을 막아 textarea의 커서·선택을 유지한다.
      // 이것이 없으면 버튼 클릭 시 textarea가 blur 되어 selectionStart가 0으로 풀려
      // "엉뚱한 곳(맨 위)에 삽입"되는 버그가 발생한다.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-divider/50 active:bg-divider transition"
    >
      {children}
    </button>
  );
}
