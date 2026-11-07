// Saves a file from a tap. The blob must already be in memory, so the phone
// accepts the save. This never opens a blank page.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const type = blob.type || 'application/pdf';
  const file = new File([blob], filename, { type });
  const canShare = typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] });
  if (canShare) {
    navigator.share({ files: [file], title: filename }).catch(err => {
      if (err && err.name === 'AbortError') return;
      clickLink(url, filename);
    });
    return url;
  }
  clickLink(url, filename);
  return url;
}

function clickLink(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function printBlob(blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'Print preview');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  frame.src = url;
  document.body.appendChild(frame);
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}