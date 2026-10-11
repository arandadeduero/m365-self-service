/**
 * Help Topics
 *
 * The questions answered on /ayuda. Text is shown as written; `link` adds a
 * button. Edit freely: nothing else depends on the wording.
 */

module.exports = [
  {
    question: 'He olvidado mi contraseña',
    answer: 'En la pantalla de inicio de este portal, pulsa «¿Has olvidado tu contraseña?» y escribe tu dirección del Ayuntamiento. Recibirás un enlace, válido 15 minutos, en tu correo personal de recuperación (o en tu buzón, si no tienes uno). Si no te llega, escribe a Informática.',
    link: { label: 'Restablecer contraseña', url: '/reset-password' },
  },
  {
    question: 'He cambiado de móvil y no puedo aprobar el inicio de sesión',
    answer: 'La aplicación Microsoft Authenticator no se pasa sola al móvil nuevo. Si todavía tienes el antiguo, entra en «Información de seguridad», añade el móvil nuevo como método y después quita el antiguo. Si ya no lo tienes, Informática tiene que darte un acceso temporal.',
    link: { label: 'Información de seguridad', url: 'https://mysignins.microsoft.com/security-info' },
  },
  {
    question: 'Mi buzón está lleno',
    answer: 'Empieza por vaciar «Elementos eliminados» y «Correo no deseado», y después ordena la bandeja por tamaño para borrar o guardar aparte los mensajes con adjuntos grandes. En «Mi cuenta» puedes ver el tamaño de buzón que incluye tu licencia.',
    link: { label: 'Ver el espacio en Outlook', url: 'https://outlook.office.com/mail/options/general/storage' },
  },
  {
    question: 'Quiero compartir un archivo con alguien de fuera del Ayuntamiento',
    answer: 'Guárdalo en OneDrive o en los archivos de tu equipo, pulsa «Compartir» y escribe la dirección de la persona: así solo ella puede abrirlo, y puedes retirarle el acceso cuando quieras. Evita «Cualquier persona con el vínculo» y no envíes como adjunto documentos con datos personales.',
    link: { label: 'Abrir OneDrive', url: 'https://www.office.com/onedrive' },
  },
  {
    question: 'He recibido un correo sospechoso',
    answer: 'No abras los adjuntos ni pulses los enlaces, y no respondas. En Outlook, usa «Informar» → «Suplantación de identidad». Si ya has escrito tu contraseña en una página a la que te llevó ese correo, cámbiala ahora y revisa «Mis inicios de sesión» en este portal.',
    link: { label: 'Mis inicios de sesión', url: '/account/sign-ins' },
  },
  {
    question: 'Necesito entrar en un grupo, un equipo o una lista de correo',
    answer: 'En «Grupos» puedes marcar los que necesitas y pedir el acceso. La solicitud le llega al propietario del grupo, que es quien decide, y puedes ver cómo va en «Solicitudes».',
    link: { label: 'Ir a Grupos', url: '/groups' },
  },
  {
    question: 'Voy a estar fuera unos días',
    answer: 'Activa las respuestas automáticas para que quien te escriba sepa cuándo vuelves y a quién dirigirse mientras tanto. Puedes programarlas entre dos fechas.',
    link: { label: 'Respuestas automáticas', url: '/profile/me/auto-reply' },
  },
  {
    question: 'Necesito instalar Word, Excel o Teams en mi ordenador',
    answer: 'En «Mi cuenta» ves qué aplicaciones incluye tu licencia. Si incluye las de escritorio, se instalan desde la página de inicio de Microsoft 365, con el botón «Instalar y más». En un equipo del Ayuntamiento, pídelo a Informática.',
    link: { label: 'Mi cuenta', url: '/account' },
  },
];
