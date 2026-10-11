/**
 * The CSRF token of the page, for fetch() calls that change something.
 * Pages that make such calls carry it in <meta name="csrf-token">.
 */
function csrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.content : '';
}
