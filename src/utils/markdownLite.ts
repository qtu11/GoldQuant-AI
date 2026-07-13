/**
 * Markdown tối giản → HTML an toàn (Daily Brief, News AI, chat).
 */
export function renderMarkdownLite(md: string): string {
  let s = String(md || '');

  // Đóng ** lẻ (token cut)
  const boldCount = (s.match(/\*\*/g) || []).length;
  if (boldCount % 2 === 1) s += '**';

  // Escape HTML
  s = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  s = s
    .replace(
      /^####\s+(.*)$/gm,
      '<h5 class="text-xs font-black text-neon-purple mt-3 mb-1">$1</h5>'
    )
    .replace(
      /^###\s+(.*)$/gm,
      '<h4 class="text-sm font-black text-neon-cyan mt-3 mb-1.5">$1</h4>'
    )
    .replace(
      /^##\s+(.*)$/gm,
      '<h3 class="text-base font-black text-white mt-3 mb-1.5">$1</h3>'
    )
    .replace(
      /^#\s+(.*)$/gm,
      '<h2 class="text-lg font-black text-white mt-3 mb-2">$1</h2>'
    );

  // Horizontal rules
  s = s.replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, '<hr class="border-dark-border my-3 opacity-60"/>');

  // Bold / italic (hỗ trợ cả "smart quotes")
  s = s
    .replace(/\*\*([^*]+?)\*\*/g, '<strong class="text-neon-cyan font-semibold">$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em class="text-neon-cyan/90">$2</em>');

  // Unordered lists * item or - item
  s = s.replace(/^[\-\*]\s+(.*)$/gm, '<li class="ml-4 list-disc my-0.5 text-dark-text-light">$1</li>');

  // Ordered lists
  s = s.replace(
    /^\d+\.\s+(.*)$/gm,
    '<li class="ml-4 list-decimal my-0.5 text-dark-text-light">$1</li>'
  );

  // Wrap consecutive <li> in <ul>
  s = s.replace(
    /((?:<li class="ml-4 list-disc[^"]*">.*?<\/li>\s*)+)/g,
    '<ul class="my-2 space-y-0.5">$1</ul>'
  );
  s = s.replace(
    /((?:<li class="ml-4 list-decimal[^"]*">.*?<\/li>\s*)+)/g,
    '<ol class="my-2 space-y-0.5">$1</ol>'
  );

  // Paragraphs
  s = s
    .replace(/\n\n+/g, '</p><p class="mb-2.5">')
    .replace(/\n/g, '<br/>');

  return `<div class="gq-md space-y-1"><p class="mb-2.5">${s}</p></div>`;
}
