// 새 노트 템플릿 — 메모 필드에 미리 채워질 양식
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
    id: 'todo',
    label: '할 일',
    desc: '체크리스트',
    title: '할 일',
    body:
      '날짜: \n\n' +
      '[오늘 할 일]\n- [ ] \n- [ ] \n- [ ] \n\n' +
      '[메모]\n- ',
  },
];
