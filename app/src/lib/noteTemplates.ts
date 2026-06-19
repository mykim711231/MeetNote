export interface NoteTemplate {
  id: string;
  label: string;
  desc: string;
  title: string;
  body: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    label: '빈 노트',
    desc: '자유롭게 작성',
    title: '새 노트',
    body: '',
  },
  {
    id: 'meeting',
    label: '회의록',
    desc: '안건·논의·결정·할 일',
    title: '회의록',
    body:
      '일시: \n참석자: \n\n' +
      '[안건]\n- \n\n' +
      '[논의 내용]\n- \n\n' +
      '[결정 사항]\n- \n\n' +
      '[할 일]\n- (담당 / 기한) ',
  },
  {
    id: 'todo',
    label: '할 일',
    desc: '체크리스트',
    title: '할 일',
    body:
      '날짜: \n\n' +
      '[오늘 할 일]\n- [ ] \n- [ ] \n- [ ] \n\n' +
      '[메모]\n- ',
  },
  {
    id: 'daily',
    label: '일일 스탠드업',
    desc: '어제·오늘·이슈',
    title: '스탠드업',
    body:
      '날짜: \n\n' +
      '[어제 한 일]\n- \n\n' +
      '[오늘 할 일]\n- [ ] \n- [ ] \n\n' +
      '[이슈 / 블로커]\n- ',
  },
  {
    id: 'interview',
    label: '인터뷰',
    desc: '질문·답변·메모',
    title: '인터뷰',
    body:
      '일시: \n대상자: \n\n' +
      '[주요 질문]\n1. \n2. \n\n' +
      '[답변 요약]\n- \n\n' +
      '[인상 / 메모]\n- ',
  },
  {
    id: '1on1',
    label: '1:1 미팅',
    desc: '관심사·피드백·목표',
    title: '1:1 미팅',
    body:
      '일시: \n대상: \n\n' +
      '[논의 주제]\n- \n\n' +
      '[피드백]\n- \n\n' +
      '[다음 액션]\n- [ ] \n- [ ] ',
  },
  {
    id: 'retrospective',
    label: '회고 (KPT)',
    desc: 'Keep · Problem · Try',
    title: '회고',
    body:
      '기간: \n\n' +
      '## Keep (잘 된 것)\n- \n\n' +
      '## Problem (문제)\n- \n\n' +
      '## Try (개선할 것)\n- ',
  },
  {
    id: 'ideas',
    label: '아이디어 메모',
    desc: '브레인스토밍',
    title: '아이디어',
    body:
      '주제: \n\n' +
      '## 아이디어\n- \n- \n- \n\n' +
      '## 우선순위\n1. \n2. \n\n' +
      '## 메모\n',
  },
  {
    id: 'lecture',
    label: '강의 노트',
    desc: '강의·요점·질문',
    title: '강의 노트',
    body:
      '강의: \n일시: \n강사: \n\n' +
      '## 핵심 내용\n- \n\n' +
      '## 모르는 것\n- [ ] \n\n' +
      '## 질문\n1. ',
  },
];

const ORDER_KEY = 'meetnote.template-order.v1';

export function loadTemplateOrder(): NoteTemplate[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (raw) {
      const ids = JSON.parse(raw) as string[];
      const map = new Map(NOTE_TEMPLATES.map((t) => [t.id, t]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean) as NoteTemplate[];
      const seen = new Set(ids);
      NOTE_TEMPLATES.forEach((t) => { if (!seen.has(t.id)) ordered.push(t); });
      return ordered;
    }
  } catch { /* noop */ }
  return [...NOTE_TEMPLATES];
}

export function saveTemplateOrder(templates: NoteTemplate[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(templates.map((t) => t.id)));
  } catch { /* noop */ }
}
