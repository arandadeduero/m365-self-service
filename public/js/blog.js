/**
 * Blog page: say when a delayed post would go out.
 */
(function () {
  const delayInput = document.getElementById('delayInput');
  const publishTimeInfo = document.getElementById('publishTimeInfo');
  if (!delayInput || !publishTimeInfo) return;

  function updatePublishTime() {
    const hours = parseInt(delayInput.value, 10) || 0;
    const date = new Date();
    date.setHours(date.getHours() + hours);
    publishTimeInfo.textContent = 'Se publicará aproximadamente el: ' + date.toLocaleString();
  }

  delayInput.addEventListener('input', updatePublishTime);
  updatePublishTime();
})();
