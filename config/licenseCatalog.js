/**
 * License Catalog
 *
 * Microsoft names licenses and the services inside them with codes. This
 * file says what they are in plain Spanish. A license or service that is not
 * listed is shown by its code (licenses) or left out (services), so the page
 * stays correct when Microsoft adds new ones.
 */

// License (SKU) codes and the name Microsoft sells them under
const SKU_NAMES = {
  O365_BUSINESS_ESSENTIALS: 'Microsoft 365 Empresa Básico',
  O365_BUSINESS_PREMIUM: 'Microsoft 365 Empresa Estándar',
  SPB: 'Microsoft 365 Empresa Premium',
  O365_BUSINESS: 'Aplicaciones de Microsoft 365 para negocios',
  OFFICESUBSCRIPTION: 'Aplicaciones de Microsoft 365 para empresas',
  STANDARDPACK: 'Office 365 E1',
  ENTERPRISEPACK: 'Office 365 E3',
  ENTERPRISEPREMIUM: 'Office 365 E5',
  DESKLESSPACK: 'Office 365 F3',
  SPE_E3: 'Microsoft 365 E3',
  SPE_E5: 'Microsoft 365 E5',
  SPE_F1: 'Microsoft 365 F3',
  M365_F1: 'Microsoft 365 F1',
  EXCHANGESTANDARD: 'Exchange Online (Plan 1)',
  EXCHANGEENTERPRISE: 'Exchange Online (Plan 2)',
  EXCHANGEDESKLESS: 'Exchange Online Kiosk',
  FLOW_FREE: 'Power Automate (gratuito)',
  POWER_BI_STANDARD: 'Power BI (gratuito)',
  TEAMS_EXPLORATORY: 'Teams Exploratory',
};

// What a user can use, and the service plans that grant it. A plan matches
// when its name starts with the text given, since Microsoft adds suffixes
// for editions and regions. `detail` overrides the description for that plan.
const APPS = [
  {
    name: 'Correo y calendario (Outlook)',
    description: 'Tu buzón, calendario y contactos',
    url: 'https://outlook.office.com/mail/',
    plans: [
      { name: 'EXCHANGE_S_ENTERPRISE', detail: 'Tu buzón, calendario y contactos. Buzón de 100 GB' },
      { name: 'EXCHANGE_S_STANDARD', detail: 'Tu buzón, calendario y contactos. Buzón de 50 GB' },
      { name: 'EXCHANGE_S_DESKLESS', detail: 'Tu buzón, calendario y contactos. Buzón de 2 GB, solo desde el navegador o el móvil' },
    ],
  },
  {
    name: 'Teams',
    description: 'Chat, reuniones y trabajo en equipo',
    url: 'https://teams.microsoft.com',
    plans: [{ name: 'TEAMS1' }],
  },
  {
    name: 'OneDrive y SharePoint',
    description: 'Tus archivos en la nube y los de tus equipos',
    url: 'https://www.office.com/launch/onedrive',
    plans: [{ name: 'SHAREPOINTENTERPRISE' }, { name: 'SHAREPOINTSTANDARD' }, { name: 'SHAREPOINTDESKLESS' }],
  },
  {
    name: 'Word, Excel y PowerPoint en el navegador',
    description: 'Crear y editar documentos sin instalar nada',
    url: 'https://www.office.com',
    plans: [{ name: 'SHAREPOINTWAC' }],
  },
  {
    name: 'Word, Excel y PowerPoint para instalar',
    description: 'Las aplicaciones de escritorio, en tu ordenador',
    url: 'https://portal.office.com/account#installs',
    plans: [{ name: 'OFFICE_BUSINESS' }, { name: 'OFFICESUBSCRIPTION' }],
  },
  {
    name: 'Planner',
    description: 'Repartir y seguir las tareas de un equipo',
    url: 'https://tasks.office.com',
    plans: [{ name: 'PROJECTWORKMANAGEMENT' }],
  },
  {
    name: 'To Do',
    description: 'Tu lista de tareas personal',
    url: 'https://to-do.office.com',
    plans: [{ name: 'BPOS_S_TODO' }],
  },
  {
    name: 'Forms',
    description: 'Formularios y encuestas',
    url: 'https://forms.office.com',
    plans: [{ name: 'FORMS_PLAN' }],
  },
  {
    name: 'Bookings',
    description: 'Agenda de citas',
    url: 'https://outlook.office.com/bookings',
    plans: [{ name: 'MICROSOFTBOOKINGS' }],
  },
  {
    name: 'Power Automate',
    description: 'Automatizar tareas repetitivas',
    url: 'https://make.powerautomate.com',
    plans: [{ name: 'FLOW_O365' }],
  },
];

module.exports = { SKU_NAMES, APPS };
