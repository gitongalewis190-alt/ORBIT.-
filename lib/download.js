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

// Prints the whole PDF. A PDF printed from a hidden frame on iPhone prints only the visible page,
// so the file is shared instead (the share sheet has Print, which prints every page). If sharing is not
// available, the PDF opens in a new tab, where the viewer prints all of it.
export function printBlob(blob, filename = 'orbit-record.pdf') {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: filename }).catch(err => {
      if (err && err.name === 'AbortError') return;
      openPdf(blob, filename);
    });
    return;
  }
  openPdf(blob, filename);
}

function openPdf(blob, filename) {
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  if (!tab) clickLink(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
