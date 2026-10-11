/**
 * Directory page: filter the table as the user types.
 */
(function () {
  const search = document.getElementById('directorySearch');
  const rows = Array.from(document.querySelectorAll('#directoryTable tbody tr'));
  const empty = document.getElementById('directoryEmpty');
  if (!search || !rows.length) return;

  // Ignore case and accents, so "garcia" finds "García"
  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const texts = rows.map((row) => normalize(row.textContent));

  search.addEventListener('input', function () {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    rows.forEach(function (row, index) {
      const matches = words.every((word) => texts[index].includes(word));
      row.classList.toggle('d-none', !matches);
      if (matches) visible += 1;
    });
    empty.classList.toggle('d-none', visible > 0);
  });
})();
