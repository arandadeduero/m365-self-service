/**
 * New password form: show or hide what is typed, and check both boxes match.
 */
(function () {
  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  const form = document.getElementById('resetPasswordForm');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    if (document.getElementById('newPassword').value !== document.getElementById('confirmPassword').value) {
      window.alert('Las contraseñas no coinciden');
      event.preventDefault();
    }
  });
})();
