/**
 * Groups page: pick groups and ask to join them.
 */
(function () {
  const checkboxes = Array.from(document.querySelectorAll('.group-checkbox'));
  const sendButton = document.getElementById('generateBtn');
  const dialog = document.getElementById('reportDialog');
  if (!sendButton || !dialog) return;

  const modal = () => bootstrap.Modal.getOrCreateInstance(dialog);
  const selected = () => checkboxes.filter((cb) => cb.checked).map((cb) => ({ id: cb.dataset.groupId, name: cb.dataset.groupName }));

  function updateSelection() {
    const count = selected().length;
    document.getElementById('selectedCount').textContent = count;
    sendButton.disabled = count === 0;
  }

  function openDialog() {
    const groups = selected();
    if (groups.length === 0) return;
    const list = document.getElementById('selectedGroupsList');
    list.replaceChildren();
    groups.forEach((group) => {
      const item = document.createElement('li');
      item.textContent = group.name;
      list.appendChild(item);
    });
    modal().show();
  }

  async function submitRequest() {
    const groups = selected();
    if (groups.length === 0) return;
    try {
      const response = await fetch('/api/group-access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ selectedGroups: groups.map((group) => group.id) }),
      });
      const data = await response.json();
      if (data.success) {
        window.alert('Solicitud de acceso enviada correctamente');
        modal().hide();
      } else {
        window.alert('Error al enviar la solicitud: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error sending request:', error);
      window.alert('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    }
  }

  checkboxes.forEach((cb) => cb.addEventListener('change', updateSelection));
  sendButton.addEventListener('click', openDialog);
  document.getElementById('submitGroupRequestBtn').addEventListener('click', submitRequest);
  document.getElementById('closeDialogBtn').addEventListener('click', () => modal().hide());
  updateSelection();
})();
