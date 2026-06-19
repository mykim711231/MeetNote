// GitHub 익명 Gist를 이용한 공유 링크 생성 (무료·계정 불필요)
// 생성된 Gist는 공개(public=false → secret)이므로 URL을 아는 사람만 접근 가능.
// 주의: 텍스트 내용이 GitHub 서버에 전송됩니다.
import type { MeetingMeta } from '@/types';
import { toMarkdown } from './export';
import { safeFilename } from './export';

export interface ShareResult {
  url: string;    // https://gist.github.com/...
  rawUrl: string; // raw 텍스트 URL (임베드·미리보기용)
}

/**
 * 회의록을 GitHub Secret Gist로 공유.
 * 익명(no auth) → description + 파일명만 노출, 내용은 URL 소지자만 접근.
 */
export async function shareToGist(meeting: MeetingMeta): Promise<ShareResult> {
  const md = toMarkdown(meeting);
  const filename = `${safeFilename(meeting.title || '회의록')}.md`;

  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      description: meeting.title || '회의록 (MeetNote)',
      public: false, // secret gist — URL을 아는 사람만 접근
      files: { [filename]: { content: md } },
    }),
  });

  if (!res.ok) {
    if (res.status === 422) throw new Error('Gist 생성 실패: 내용이 너무 크거나 잘못된 형식입니다.');
    if (res.status === 403 || res.status === 429) throw new Error('GitHub API 한도 초과. 잠시 후 다시 시도하세요.');
    throw new Error(`Gist 생성 실패 (${res.status})`);
  }

  const data = await res.json();
  const url: string = data.html_url;
  const rawUrl: string = data.files?.[filename]?.raw_url ?? url;
  if (!url) throw new Error('Gist URL을 받지 못했습니다.');
  return { url, rawUrl };
}
