/**
 * Automatic replies page: the dates only matter when the reply is scheduled.
 */
(function () {
  const schedule = document.getElementById('scheduleFields');
  const scheduled = document.getElementById('statusScheduled');
  if (!schedule || !scheduled) return;

  const update = () => schedule.classList.toggle('d-none', !scheduled.checked);
  document.querySelectorAll('input[name="status"]').forEach((radio) => radio.addEventListener('change', update));
  update();
})();
