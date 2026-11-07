// Saves a Blob to the phone or computer.
// iPhone Safari ignores a download link that is created after an await, so the
// caller opens a blank tab during the tap and this points that tab at the file.
export function downloadBlob(blob, filename, preview) {
  const url = URL.createObjectURL(blob);
  const type = blob.type || 'application/pdf';
  const file = new File([blob], filename, { type });

  if (preview && !preview.closed) {
    preview.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return url;
  }

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
