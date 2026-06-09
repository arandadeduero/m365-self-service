/**
 * Client-side JavaScript for Profile Page
 * Handles UI interactions
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Profile page loaded');

  // Optional: Add copy to clipboard functionality for JSON data
  const jsonContainer = document.querySelector('.json-container pre');
  if (jsonContainer) {
    jsonContainer.addEventListener('click', function() {
      const text = this.textContent;
      navigator.clipboard.writeText(text).then(() => {
        console.log('JSON copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    });
  }
});
