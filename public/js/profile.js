/**
 * Profile page: the "my manager is wrong" dialog.
 */
(function () {
  const dialog = document.getElementById('managerDialog');
  if (!dialog) return;
  const modal = () => bootstrap.Modal.getOrCreateInstance(dialog);
  let allUsers = [];

  function populateManagerSelect() {
    const select = document.getElementById('managerSelect');
    select.replaceChildren(new Option('-- Selecciona un responsable --', ''));
    allUsers.forEach((user) => {
      const option = new Option(`${user.displayName}${user.jobTitle ? ' - ' + user.jobTitle : ''}${user.department ? ' (' + user.department + ')' : ''}`, user.id);
      option.dataset.name = user.displayName;
      option.dataset.email = user.mail || user.userPrincipalName || '';
      select.appendChild(option);
    });
  }

  async function openManagerDialog() {
    modal().show();
    if (allUsers.length > 0) return;
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        allUsers = data.users;
        populateManagerSelect();
      } else {
        window.alert('No se pudieron cargar los usuarios. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      window.alert('No se pudieron cargar los usuarios. Inténtalo de nuevo.');
    }
  }

  async function submitManagerCorrection() {
    const select = document.getElementById('managerSelect');
    const option = select.options[select.selectedIndex];
    if (!select.value) {
      window.alert('Selecciona un responsable');
      return;
    }
    try {
      const response = await fetch('/api/manager-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ selectedManagerId: select.value, selectedManagerName: option.dataset.name, selectedManagerEmail: option.dataset.email }),
      });
      const data = await response.json();
      if (data.success) {
        window.alert('Solicitud de corrección de responsable enviada correctamente');
        modal().hide();
      } else {
        window.alert('Error: ' + (data.error || 'No se pudo enviar la solicitud de corrección'));
      }
    } catch (error) {
      console.error('Error submitting manager correction:', error);
      window.alert('No se pudo enviar la solicitud de corrección. Inténtalo de nuevo.');
    }
  }

  document.getElementById('openManagerDialogBtn')?.addEventListener('click', openManagerDialog);
  document.getElementById('submitManagerCorrectionBtn')?.addEventListener('click', submitManagerCorrection);
  document.getElementById('closeManagerDialogBtn')?.addEventListener('click', () => modal().hide());
})();
