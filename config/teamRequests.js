/**
 * The requests a person in charge can send to IT from the team page: what
 * each one asks for, and how the email is headed. All text is here so that
 * the forms and the emails can be changed without touching the code.
 */
module.exports = {
  alta: {
    title: 'Nueva incorporación',
    subject: 'Alta de una nueva persona',
    event: 'request.onboarding',
    intro: 'Pide la cuenta de Microsoft 365 de alguien que se incorpora. Informática la creará y te dirá cómo entregarle la contraseña.',
    fields: [
      { name: 'fullName', label: 'Nombre y apellidos', required: true },
      { name: 'jobTitle', label: 'Puesto', required: true },
      { name: 'department', label: 'Concejalía o departamento', required: true },
      { name: 'startDate', label: 'Fecha de incorporación', type: 'date', required: true },
      { name: 'likeUser', label: 'Con los mismos grupos y accesos que', placeholder: 'nombre o correo de un compañero', required: false },
      { name: 'phone', label: 'Extensión o teléfono', required: false },
      { name: 'notes', label: 'Otras necesidades', type: 'textarea', placeholder: 'buzones compartidos, equipos de Teams, programas…', required: false },
    ],
  },
  baja: {
    title: 'Baja de una persona',
    subject: 'Baja de una persona',
    event: 'request.offboarding',
    intro: 'Avisa de que alguien deja el Ayuntamiento, para que su cuenta se cierre el día que toca y nada se pierda.',
    fields: [
      { name: 'person', label: 'Persona', placeholder: 'nombre o correo', required: true },
      { name: 'lastDay', label: 'Último día', type: 'date', required: true },
      { name: 'forwardTo', label: 'Reenviar su correo a', placeholder: 'correo de un compañero, o nadie', required: false },
      { name: 'filesTo', label: 'Dar acceso a sus archivos a', placeholder: 'correo de un compañero', required: false },
      { name: 'notes', label: 'Otras indicaciones', type: 'textarea', required: false },
    ],
  },
  teams: {
    title: 'Nuevo equipo de Teams',
    subject: 'Nuevo equipo de Teams',
    event: 'request.team',
    intro: 'Pide un equipo de Teams para un grupo de trabajo. Informática lo crea con el nombre acordado y te hace propietario.',
    fields: [
      { name: 'teamName', label: 'Nombre del equipo', required: true },
      { name: 'purpose', label: 'Para qué es', type: 'textarea', required: true },
      { name: 'members', label: 'Quién tiene que estar', type: 'textarea', placeholder: 'nombres o correos', required: true },
      { name: 'privacy', label: 'Quién puede verlo', type: 'select', options: ['Solo sus miembros', 'Cualquiera del Ayuntamiento puede unirse'], required: true },
    ],
  },
  invitado: {
    title: 'Invitar a alguien de fuera',
    subject: 'Invitado externo',
    event: 'request.guest',
    intro: 'Pide que una persona de fuera del Ayuntamiento (otra administración, una empresa) pueda entrar en un equipo o ver unos archivos.',
    fields: [
      { name: 'guestName', label: 'Nombre de la persona', required: true },
      { name: 'guestEmail', label: 'Su correo', type: 'email', required: true },
      { name: 'organization', label: 'De dónde es', required: true },
      { name: 'access', label: 'A qué tiene que acceder', type: 'textarea', placeholder: 'equipo de Teams, carpeta…', required: true },
      { name: 'until', label: 'Hasta cuándo', type: 'date', required: false },
    ],
  },
};
