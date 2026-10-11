/**
 * Debug page: a click on a block copies it.
 */
document.querySelectorAll('.json-container').forEach((block) => {
  block.addEventListener('click', () => {
    navigator.clipboard.writeText(block.textContent.trim()).catch((error) => console.error('Could not copy:', error));
  });
});
