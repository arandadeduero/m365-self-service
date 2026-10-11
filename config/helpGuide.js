/**
 * Help Guide
 *
 * The introduction of /ayuda: what Microsoft 365 is and what the organization
 * has in it. Text is shown as written. Edit freely: nothing else depends on
 * the wording. Which of these each person actually has depends on their
 * license, which the account page shows.
 */

module.exports = {
  // Shown in order, one paragraph each
  intro: [
    'Microsoft 365 es el conjunto de herramientas de trabajo del Ayuntamiento: el correo, el calendario, las reuniones, el chat, los documentos y el sitio donde se guardan. Todo funciona con una sola cuenta, la tuya del Ayuntamiento, y con la misma contraseña.',
    'No está instalado en tu ordenador, sino en internet. Por eso puedes entrar desde cualquier equipo o desde el móvil, y lo que guardas no se pierde si tu ordenador se estropea. También por eso la cuenta se protege con un segundo paso al iniciar sesión, además de la contraseña.',
  ],

  // How to get in
  access: [
    { label: 'Desde el navegador', text: 'Entra en office.com con tu dirección del Ayuntamiento. Desde ahí se abren todas las aplicaciones, sin instalar nada.' },
    { label: 'Desde el ordenador', text: 'Outlook, Teams, Word, Excel y PowerPoint también existen como programas instalados, si tu licencia los incluye. En un equipo del Ayuntamiento los instala Informática.' },
    { label: 'Desde el móvil', text: 'Outlook, Teams y OneDrive tienen aplicación para móvil. Para aprobar los inicios de sesión se usa Microsoft Authenticator.' },
  ],
  accessUrl: 'https://www.office.com',

  // What there is, and what each thing is for
  tools: [
    { name: 'Outlook', use: 'Correo, calendario y contactos', detail: 'Tu buzón y tu agenda. Desde el calendario se convocan las reuniones y se reservan las salas.', url: 'https://outlook.office.com/mail/' },
    { name: 'Teams', use: 'Chat, reuniones y trabajo en equipo', detail: 'Mensajes rápidos, llamadas y videollamadas. Cada equipo tiene sus canales de conversación y sus propios archivos.', url: 'https://teams.microsoft.com' },
    { name: 'OneDrive', use: 'Tus archivos de trabajo', detail: 'Tu espacio personal para documentos de trabajo. Solo los ves tú, hasta que decides compartir alguno.', url: 'https://www.office.com/launch/onedrive' },
    { name: 'SharePoint', use: 'Los archivos de cada equipo y la intranet', detail: 'Donde se guardan los documentos que son de un servicio o de un equipo, no de una persona. La intranet del Ayuntamiento también está aquí.', url: 'https://www.office.com/launch/sharepoint' },
    { name: 'Word, Excel y PowerPoint', use: 'Documentos, hojas de cálculo y presentaciones', detail: 'Se pueden usar en el navegador o instalados. Varias personas pueden trabajar en el mismo documento a la vez, sin enviarse copias.', url: 'https://www.office.com' },
    { name: 'Forms', use: 'Formularios y encuestas', detail: 'Para recoger respuestas (inscripciones, encuestas, peticiones internas) y verlas resumidas o en Excel.', url: 'https://forms.office.com' },
    { name: 'Planner y To Do', use: 'Tareas', detail: 'Planner reparte y sigue las tareas de un equipo. To Do es tu lista personal, y reúne también las tareas que te asignan.', url: 'https://tasks.office.com' },
  ],

  // The question people actually have
  whereToSave: [
    { what: 'Es un documento mío, o un borrador', where: 'OneDrive' },
    { what: 'Es de mi servicio o de un equipo, y otros tienen que encontrarlo', where: 'Los archivos del equipo, en Teams o SharePoint' },
    { what: 'Es información para todo el Ayuntamiento', where: 'La intranet' },
    { what: 'Hay que enviárselo a alguien de fuera', where: 'Compártelo desde OneDrive con esa persona, mejor que como adjunto' },
  ],
};
