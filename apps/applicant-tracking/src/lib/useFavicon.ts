import { useEffect } from 'react';

// The platform rewrites the document head at serve time and injects its own
// <link rel="icon">, so the tag in index.html never survives. Replacing it from
// the app is the only place that wins. The mark is inlined as a data URI rather
// than fetched from /favicon.svg because the internal app is served under a
// workspace path where an absolute asset path does not resolve.
const MARK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<rect width="32" height="32" rx="7" fill="#5E6AD2"/>' +
      '<path d="M10.5 23.5L16 8.5l5.5 15M12.2 18.8h7.6" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '</svg>',
  );

export function useFavicon(title?: string) {
  useEffect(() => {
    document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = MARK;
    document.head.appendChild(link);
    if (title) document.title = title;
  }, [title]);
}
