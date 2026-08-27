/**
 * Opens an external URL in a new browser tab.
 *
 * Using window.open() directly can fail inside sandboxed/embedded iframes
 * (e.g. the app preview), where the navigation ends up inside the iframe and
 * Google Drive refuses to be framed ("drive.google.com è bloccato").
 * Creating a real anchor with target="_blank" + rel="noopener noreferrer"
 * makes the browser open a top-level tab instead.
 */
export function openExternal(url: string) {
  if (!url) return;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
