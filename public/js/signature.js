/**
 * Signature page: copy the signature with its formatting, or as text where
 * the browser cannot do better.
 */
(function () {
  const button = document.getElementById('copySignature');
  const preview = document.getElementById('signaturePreview');
  const text = document.getElementById('signatureText');
  const done = document.getElementById('copyDone');
  if (!button || !preview) return;

  async function copy() {
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([preview.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([text.value], { type: 'text/plain' }),
        })]);
      } else {
        const range = document.createRange();
        range.selectNodeContents(preview);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('copy');
        selection.removeAllRanges();
      }
      done.classList.remove('d-none');
    } catch (error) {
      console.error('Could not copy the signature:', error);
      window.alert('No se ha podido copiar. Selecciona la firma con el ratón y cópiala con Ctrl+C.');
    }
  }

  button.addEventListener('click', copy);
})();
