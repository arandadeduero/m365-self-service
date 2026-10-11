/**
 * Rooms page: sort the table by clicking a column heading.
 * The values come from data attributes on each row, so the text in the cells
 * can say "8 personas" while the sort uses 8.
 */
(function () {
  const table = document.getElementById('roomsTable');
  if (!table) return;
  const body = table.tBodies[0];
  const buttons = Array.from(table.querySelectorAll('.table-sort'));

  const valueOf = (row, key, type) => (type === 'number' ? Number(row.dataset[key]) || 0 : row.dataset[key] || '');

  const compare = (type) => (type === 'number'
    ? (a, b) => a - b
    : (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.sort;
      const type = button.dataset.type;
      // Same column again: the other way round
      const descending = button.getAttribute('aria-sort') === 'ascending';

      buttons.forEach((other) => other.removeAttribute('aria-sort'));
      button.setAttribute('aria-sort', descending ? 'descending' : 'ascending');

      const rows = Array.from(body.rows);
      const order = compare(type);
      rows.sort((a, b) => {
        const result = order(valueOf(a, key, type), valueOf(b, key, type));
        return descending ? -result : result;
      });
      rows.forEach((row) => body.appendChild(row));
    });
  });
})();
