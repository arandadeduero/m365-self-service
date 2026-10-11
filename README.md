# Mi Microsoft 365 - Ayuntamiento de Aranda de Duero

Portal interno de autoservicio para los usuarios de Microsoft 365 del Ayuntamiento de Aranda de Duero. El personal inicia sesión con su cuenta de Microsoft 365 para ver y editar su perfil, consultar grupos y Teams, ver el organigrama, publicar en el blog municipal de WordPress y restablecer una contraseña olvidada. Hecho con Node.js, Express, EJS y Bootstrap 5.


## Funciones

- ✅ **Autenticación con Microsoft 365** - Flujo de código de autorización OAuth 2.0 con MSAL, para un solo inquilino (tenant)
- ✅ **Perfil** - Perfil, foto, grupos, responsable y datos en bruto de Graph; cada usuario puede editar su puesto, teléfonos, oficina y foto. Los campos que Microsoft no deja cambiar a un usuario se muestran en solo lectura
- ✅ **Directorio** - Directorio del personal con buscador, teléfonos y oficinas
- ✅ **Mi cuenta** - Qué incluye la licencia en lenguaje llano con un enlace a cada aplicación, espacio de OneDrive, una lista de comprobación de la cuenta, antigüedad y caducidad de la contraseña, métodos de inicio de sesión con un aviso cuando no hay segundo factor, dispositivos, reglas de la bandeja de entrada con un aviso cuando el correo se reenvía fuera, y la dirección de recuperación
- ✅ **Mis grupos** - Qué es cada grupo al que pertenece el usuario (un Team, una lista de correo, un grupo de seguridad) y qué le da
- ✅ **Mis inicios de sesión** - Dónde y cuándo se ha usado la cuenta últimamente, con un botón «No fui yo» que avisa a Informática y cierra todas las sesiones de la cuenta
- ✅ **Calendario compartido** - Quién puede ver el calendario del usuario y qué puede hacer cada uno, con un aviso para las personas de fuera de la organización
- ✅ **Buzones compartidos** - Cuáles de los buzones compartidos de la organización puede abrir el usuario
- ✅ **Herramientas para propietarios** - Los propietarios ven los miembros e invitados de sus grupos, añaden y quitan miembros, y reciben un aviso cuando un grupo tiene un único propietario
- ✅ **Salas** - Las salas de reuniones con su ubicación y aforo, cuáles están libres a una hora dada, y un enlace que las reserva en Outlook
- ✅ **Ayuda** - Qué es Microsoft 365 y qué herramientas tiene la organización, respuestas a las preguntas habituales y un formulario para escribir a Informática con el estado de la cuenta adjunto
- ✅ **Enlace a la intranet** - La página de inicio, la de ayuda y el pie enlazan a la intranet de la organización
- ✅ **Configuración regional** - Cada cuenta se vuelve a poner en hora de Madrid y en español en cada inicio de sesión
- ✅ **Visor de auditoría** - Los administradores pueden leer y filtrar el registro de auditoría desde la aplicación
- ✅ **Estado del servicio** - Un aviso en todas las páginas mientras Microsoft informa de una incidencia en Microsoft 365
- ✅ **Respuestas automáticas** - Activar, desactivar o programar entre dos fechas las respuestas de fuera de la oficina
- ✅ **Grupos** - Todos los grupos del inquilino con el estado de pertenencia; las solicitudes para entrar van a los propietarios del grupo, que aprueban o rechazan en la aplicación
- ✅ **Teams** - Los equipos a los que pertenece el usuario y sus canales
- ✅ **Organigrama** - Organigrama construido con el responsable de cada usuario, con buscador y una lista de las cuentas que quedan fuera del árbol
- ✅ **Publicar en Blog** - Publicar entradas en WordPress por correo, con adjuntos PDF y programación (retraso)
- ✅ **Restablecer contraseña** - Enlace de autoservicio enviado por correo (AWS SES) a la dirección alternativa del usuario: válido 15 minutos, de un solo uso y con límite de intentos
- ✅ **Registro de auditoría** - Quién inició sesión, quién cambió qué y quién pidió qué, una línea JSON por evento
- ✅ **Protección CSRF** - Cada formulario y cada petición desde el navegador lleva un token propio de la sesión
- ✅ **Renovación silenciosa de tokens** - Los tokens de acceso se renuevan en segundo plano, así que los usuarios siguen con la sesión iniciada todo el tiempo que dura
- ✅ **Aviso de administrador** - Quien tiene un rol de directorio de Entra ve un aviso ADMIN y sus roles
- ✅ **Permisos por ruta** - `/blog` está restringido a una lista de usuarios que se guarda en `config/local.js`
- ✅ **Sesiones persistentes** - Las sesiones se guardan en archivos, para mantener el inicio de sesión aunque se reinicie el servidor
- ✅ **Páginas de error** - Página de error amable; el mensaje real solo se muestra fuera de producción
- ✅ **Sin llamadas a otros servidores** - Bootstrap, la tipografía y las librerías del organigrama las sirve la propia aplicación; las páginas no cargan nada de CDN ni de servicios externos
- ✅ **Batería de tests** - Ava + supertest, con Microsoft Graph, MSAL, AWS SES y WordPress simulados
- ✅ **Imagen Docker** - Se construye y se publica en GitHub Container Registry en cada push a `main`
- ✅ **Servidor de desarrollo con reinicio automático** - Nodemon, para desarrollar con comodidad

## Pantallas

### Página de perfil
Después de iniciar sesión verás:
- Tu foto de perfil y tus datos básicos
- Datos de contacto
- Grupos a los que perteneces
- Datos de tu responsable
- Los datos JSON en bruto, plegables

### Página de grupos
Consulta y gestiona el acceso a los grupos:
- Todos los grupos del inquilino con un indicador visual de pertenencia (✓ verde / ✗ rojo)
- Selecciona grupos a los que no perteneces para pedir acceso
- Genera informes con formato de las solicitudes de acceso
- Filtra y busca entre los grupos

## Tecnología

Las versiones exactas están en `package.json`.

- **Entorno de ejecución**: Node.js >= 25
- **Framework**: Express 5
- **Motor de plantillas**: EJS
- **Autenticación**: @azure/msal-node
- **Cliente HTTP**: axios (Microsoft Graph y la API REST de WordPress)
- **Sesiones**: express-session + session-file-store
- **Correo**: `sendMail` de Microsoft Graph (como el usuario que ha iniciado sesión) y AWS SES (restablecimiento de contraseña)
- **Subida de archivos**: multer (en memoria, adjuntos del blog)
- **Tests**: ava + supertest
- **Servidor de desarrollo**: nodemon

## Requisitos previos

- **Node.js** versión 25 o superior
- **npm** versión 10 o superior
- **Cuenta de Azure** con acceso a Entra ID (Azure AD)
- **Cuenta de Microsoft 365** para probar

---

## Parte 1: Configuración en Azure/Entra ID

Antes de ejecutar la aplicación hay que registrarla en Azure Portal.

### Paso 1: Registrar la aplicación

1. Ve a [Azure Portal](https://portal.azure.com)
2. Entra en **Microsoft Entra ID** → **Registros de aplicaciones**
3. Pulsa **Nuevo registro**

### Paso 2: Rellenar el formulario de registro

- **Nombre**: `Mi Microsoft 365 - Ayuntamiento de Aranda de Duero` (o el que prefieras)
- **Tipos de cuenta compatibles**: elige **«Solo las cuentas de este directorio organizativo (inquilino único)»**
- **URI de redirección**:
  - Plataforma: **Web**
  - URI: `http://localhost:3000/auth/callback`

Pulsa **Registrar**

### Paso 3: Copiar los valores importantes

Tras el registro verás la página de información general de la aplicación. **Copia estos valores** (los necesitarás después):

- **Id. de aplicación (cliente)** - Ejemplo: `12345678-1234-1234-1234-123456789abc`
- **Id. de directorio (inquilino)** - Ejemplo: `87654321-4321-4321-4321-cba987654321`

### Paso 4: Crear un secreto de cliente

1. En el menú de la izquierda, ve a **Certificados y secretos**
2. Pulsa **Secretos de cliente** → **Nuevo secreto de cliente**
3. Añade una descripción: `Production Secret`
4. Elige el periodo de caducidad: **24 meses** (o el que prefieras)
5. Pulsa **Agregar**
6. **⚠️ COPIA EL VALOR DEL SECRETO EN ESE MOMENTO** - ¡No podrás volver a verlo!

### Paso 5: Configurar los permisos de API

  1. En el menú de la izquierda, ve a **Permisos de API**
  2. Pulsa **Agregar un permiso** → **Microsoft Graph** → **Permisos delegados**
  3. Añade estos permisos:
     - ✅ `User.Read` - Leer el perfil del usuario
     - ✅ `User.ReadWrite` - Permitir que los usuarios editen su propio perfil
     - ✅ `User.ReadBasic.All` - Leer el perfil básico de todos los usuarios
     - ✅ `GroupMember.Read.All` - Leer los grupos a los que pertenece el usuario
     - ✅ `GroupMember.ReadWrite.All` - Permitir que el propietario de un grupo añada a la persona cuya solicitud aprueba
     - ✅ `UserAuthenticationMethod.Read` - Leer los métodos de inicio de sesión del propio usuario (página de la cuenta)
     - ✅ `Group.Read.All` - Leer todos los grupos del inquilino (para la página de grupos)
     - ✅ `Directory.Read.All` - Leer datos del directorio
     - ✅ `MailboxSettings.ReadWrite` - Leer y cambiar las respuestas automáticas del usuario
     - ✅ `Mail.Send` - Enviar correos como el usuario que ha iniciado sesión (para las correcciones de responsable y las entradas del blog)
     - ✅ `Files.Read` - Leer cuánto espacio de OneDrive ha usado el usuario. El permiso cubre los archivos del usuario en general; la aplicación solo pide la cuota
     - ✅ `User.RevokeSessions.All` - Cerrar las sesiones del propio usuario cuando denuncia un inicio de sesión («No fui yo»)
     - ✅ `Calendars.Read` - Leer con quién está compartido el calendario y si las salas están libres. El permiso cubre el calendario del usuario en general; la aplicación no lee las citas
     - ✅ `Mail.Read.Shared` - Comprobar qué buzones compartidos puede abrir el usuario. El permiso deja a una aplicación leer el correo del usuario y el correo compartido al que tiene acceso; la aplicación solo pregunta si existe cada bandeja de entrada y nunca lee un mensaje
     - ✅ `Place.Read.All` - Leer la lista de salas de reuniones
     - ✅ `offline_access` - Mantener el acceso a los datos
     - ✅ `Team.ReadBasic.All` - Leer los equipos a los que pertenece el usuario (página de Teams)
     - ✅ `Channel.ReadBasic.All` - Leer los canales de esos equipos
  4. Pulsa **Agregar permisos**
  5. (Recomendado) Pulsa **Conceder consentimiento de administrador para [tu organización]**
     - Así los usuarios pueden iniciar sesión sin que a cada uno se le pida consentimiento

  La lista anterior tiene que coincidir con `scopes` en `config/authConfig.js`.

  **«Mis inicios de sesión» necesita un permiso de aplicación y una licencia.** Añade `AuditLog.Read.All` como permiso de *Aplicación*, con consentimiento de administrador. Microsoft solo sirve el registro de inicios de sesión a los inquilinos con Entra ID P1 o P2. Sin cualquiera de las dos cosas, la página dice que el registro no está disponible. La aplicación solo lee el registro del usuario que ha iniciado sesión.

  **El aviso de estado del servicio necesita un permiso de aplicación.** Añade `ServiceHealth.Read.All` como permiso de *Aplicación*, con consentimiento de administrador. Sin él la aplicación funciona y simplemente nunca muestra el aviso.

  **El restablecimiento de contraseña también necesita permisos de aplicación.** Las páginas de restablecimiento funcionan sin un usuario con sesión iniciada, así que llaman a Microsoft Graph con un token solo de aplicación (credenciales de cliente). Por eso el registro de la aplicación necesita además permisos de *Aplicación*, con consentimiento de administrador, para leer usuarios (incluido `lastPasswordChangeDateTime`, que es lo que hace que los enlaces sean de un solo uso) y para actualizar el `passwordProfile` de un usuario. Consulta en la documentación actual de Microsoft Graph, en «Update user», el permiso exacto y el rol de directorio necesarios para cambiar contraseñas, porque es más restrictivo que una actualización normal del perfil.

### Paso 6: Rellenar las direcciones de correo alternativas

El enlace para restablecer la contraseña se envía a la primera **dirección de correo alternativa** de la cuenta (`otherMails` en Entra ID, «Otros correos electrónicos» en el portal de administración), porque quien ha olvidado su contraseña normalmente no puede abrir el buzón de esa misma cuenta. Las cuentas que no tienen ninguna reciben el enlace en su buzón de Microsoft 365. La página «Mi cuenta» le dice a cada usuario cuál de los dos casos es el suyo.

### Paso 7: Añadir la integración con WordPress (Jetpack)

  1. Activa **Publicar por correo electrónico** en los ajustes de Jetpack de tu sitio WordPress.
  2. Copia la dirección de correo que se genera.
  3. Añádela a tu archivo `.env` como `JETPACK_POST_BY_EMAIL`.

### Paso 8: Comprobar los ajustes


- Ve a la pestaña **Autenticación**
- Comprueba que **Permitir flujos de clientes públicos** está en **No**
- En **Flujos de concesión implícita e híbridos**, deja todas las casillas sin marcar
- Usamos el flujo de código de autorización (el más seguro)

**✅ ¡Azure está configurado!** Ya puedes preparar la aplicación.

---

## Parte 2: Preparar el entorno de desarrollo

### Paso 1: Clonar o descargar el repositorio

```bash
# Con git
git clone <repository-url>
cd mi-microsoft-365

# O descarga y descomprime el archivo ZIP
```

### Paso 2: Instalar las dependencias

```bash
npm install
```

Esto instala todos los paquetes necesarios, entre ellos Express, MSAL, axios, EJS y las herramientas de desarrollo.

### Paso 3: Configurar las variables de entorno

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Abre `.env` en tu editor y rellena los valores de Azure:

```env
# Del registro de la aplicación en Azure
CLIENT_ID=your-application-client-id-here
CLIENT_SECRET=your-client-secret-value-here
TENANT_ID=your-tenant-id-here

# Configuración para desarrollo en local
REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
NODE_ENV=development

# Genera un secreto aleatorio para las sesiones
SESSION_SECRET=your-random-session-secret-here

# Cifra los enlaces de restablecimiento de contraseña. Sin él, el restablecimiento no funciona
TOKEN_SECRET=another-random-secret-here
```

`.env.example` recoge también los ajustes de WordPress y de AWS SES; todos están en la [Parte 5](#parte-5-variables-de-entorno).

**Cómo generar SESSION_SECRET y TOKEN_SECRET:**

```bash
# macOS/Linux
openssl rand -base64 32

# O con Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Paso 4: Configurar los permisos por ruta (opcional)

La página del blog está cerrada para todos hasta que digas quién puede usarla. Copia el ejemplo y pon los nombres de usuario (la parte del correo que va antes de `@`):

```bash
cp config/local.example.js config/local.js
```

```javascript
module.exports = {
  permissions: {
    DOMAIN: 'arandadeduero.es',
    '/blog': ['username1', 'username2']
  }
};
```

git ignora `config/local.js`. Reinicia el servidor después de cambiarlo.

En el mismo archivo va la lista de buzones compartidos de la organización, que Microsoft Graph no puede listar por sí solo:

```javascript
module.exports = {
  permissions: { /* ... */ },
  sharedMailboxes: ['registro@arandadeduero.es', 'obras@arandadeduero.es']
};
```

Con ella, cada usuario ve en «Mi cuenta» → «Buzones compartidos» los de esa lista que puede abrir. Sin la lista, el enlace no se muestra.

### Paso 5: Arrancar el servidor de desarrollo

```bash
# Arranca con reinicio automático al cambiar archivos
npm run dev

# O arranca de forma normal
npm start
```

Deberías ver:

```
=================================
Server running on port 3000
Environment: development
URL: http://localhost:3000
=================================
```

### Paso 6: Probar la aplicación

1. Abre `http://localhost:3000` en el navegador
2. Verás la página de inicio de sesión
3. Pulsa **«Iniciar sesión con Microsoft»**
4. Inicia sesión con tu cuenta de Microsoft 365
5. Volverás a tu página de perfil, con:
   - Tu foto de perfil
   - Datos de contacto
   - Grupos a los que perteneces
   - Datos de tu responsable
   - Los datos JSON en bruto (plegables)

---

## Parte 3: Estructura del proyecto

```
mi-microsoft-365/
├── server.js                         # Aplicación Express: middleware, sesiones, rutas
├── package.json                      # Dependencias y scripts
├── .env.example                      # Plantilla de las variables de entorno
├── nodemon.json                      # Configuración del reinicio automático
├── Dockerfile / .dockerignore        # Imagen de producción
├── docker-compose.yml                # Cómo ejecutarla en producción (imagen de GHCR, volúmenes, proxy delante)
├── Procfile                          # Configuración para desplegar en Heroku
├── CLAUDE.md                         # Notas para trabajar en el código con Claude Code
│
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── test.yml                  # Ejecuta npm test en cada push y pull request
│       └── docker-publish.yml        # Construye la imagen y la sube a GHCR
│
├── config/
│   ├── authConfig.js                 # Configuración de MSAL y permisos (scopes) de Graph
│   ├── graphConfig.js                # Direcciones de la API de Microsoft Graph
│   ├── permissions.js                # Dominio permitido y listas de usuarios por ruta
│   ├── local.example.js              # Plantilla de config/local.js (ignorado por git)
│   ├── appConfig.js                  # Buzón de administración, dirección pública, zona horaria e idioma
│   ├── licenseCatalog.js             # Licencias y servicios en castellano llano
│   ├── helpGuide.js                  # Texto de la introducción a Microsoft 365 de la página de ayuda
│   ├── helpTopics.js                 # Preguntas y respuestas de la página de ayuda
│   └── wpConfig.js                   # Dirección de Publicar por correo de Jetpack
│
├── middleware/
│   ├── auth.js                       # Autenticación, renovación de tokens, rol de administrador, permisos
│   ├── rateLimit.js                  # Límites de las páginas de restablecimiento de contraseña
│   ├── csrf.js                       # Token CSRF para formularios y peticiones desde el navegador
│   └── errorHandler.js               # 404, tokens rechazados y página de error
│
├── routes/
│   ├── auth.js                       # Inicio de sesión, retorno de OAuth, cierre de sesión
│   ├── index.js                      # Perfil, grupos, teams, organigrama, APIs, restablecimiento de contraseña
│   ├── account.js                    # Directorio, páginas de la cuenta, respuestas automáticas, foto
│   ├── admin.js                      # Visor de auditoría para administradores
│   ├── groupRequests.js              # Pedir entrar en un grupo, aprobación de los propietarios
│   ├── ownedGroups.js                # Propietarios: ver y cambiar los miembros de sus grupos
│   ├── help.js                       # Página de ayuda y su formulario de contacto
│   ├── rooms.js                      # Salas de reuniones libres
│   └── blog.js                       # Publicar en el blog de WordPress
│
├── services/
│   ├── graphService.js               # Llamadas a la API de Microsoft Graph
│   ├── tokenService.js               # MSAL: inicio de sesión, renovación de tokens, tokens solo de aplicación
│   ├── resetTokenService.js          # Token cifrado que llevan los enlaces de restablecimiento
│   ├── accountInsights.js            # Convierte los datos de Graph en lo que dicen las páginas de la cuenta
│   ├── orgChart.js                   # Convierte el directorio en el árbol del organigrama
│   ├── regionalSettings.js           # Mantiene las cuentas en hora de Madrid y en español
│   ├── auditService.js               # Registro de auditoría
│   ├── requestStore.js               # Solicitudes para entrar en grupos (archivo JSON)
│   ├── serviceHealthService.js       # Incidencias de Microsoft 365, en caché
│   ├── emailService.js               # Correos de restablecimiento de contraseña (AWS SES)
│   └── wpService.js                  # API REST de WordPress (categorías)
│
├── public/
│   ├── css/custom.css                # Estilos propios y declaración de la tipografía
│   ├── js/                           # profile.js, organigrama.js
│   ├── images/                       # Avatar por defecto
│   └── vendor/                       # Bootstrap, Outfit y d3, servidos por la aplicación (ver su README.md)
│
├── views/
│   ├── partials/                     # header.ejs, footer.ejs
│   ├── login.ejs
│   ├── profile.ejs / edit-profile.ejs
│   ├── groups.ejs / group-requests.ejs / teams.ejs / organigrama.ejs
│   ├── directory.ejs / account.ejs / auto-reply.ejs
│   ├── my-groups.ejs / mailboxes.ejs / audit.ejs
│   ├── sign-ins.ejs / sign-in-reported.ejs
│   ├── owned-groups.ejs / owned-group.ejs
│   ├── rooms.ejs / help.ejs
│   ├── blog.ejs
│   ├── reset-password.ejs / reset-password-form.ejs
│   └── error.ejs                     # Página de error
│
├── sessions/                         # Archivos de sesión (se crean al ejecutar, ignorados por git)
├── audit/                            # Registro de auditoría, un archivo por día (se crea al ejecutar, ignorado por git)
├── data/                             # Solicitudes para entrar en grupos (se crea al ejecutar, ignorado por git)
│
└── test/
    ├── helpers/
    │   ├── env.js                    # Entorno fijo para los tests
    │   └── stubs.js                  # Simulaciones de axios, MSAL y AWS SES
    ├── auth.test.js                  # Rutas de OAuth sin sesión
    ├── routes.test.js                # Protección de rutas y página de inicio de sesión
    ├── authenticated.test.js         # Perfil, grupos, teams, blog y APIs con sesión iniciada
    ├── account.test.js               # Directorio, páginas de la cuenta, respuestas automáticas, foto
    ├── accountInsights.test.js       # Licencias, grupos, reglas y lista de comprobación en lenguaje llano
    ├── orgChart.test.js              # Árbol del organigrama y cuentas que quedan fuera
    ├── regional-settings.test.js     # Hora de Madrid y español al iniciar sesión
    ├── audit-viewer.test.js          # Página de auditoría para administradores
    ├── group-requests.test.js        # Solicitudes de grupos con varios usuarios
    ├── owned-groups.test.js          # Herramientas para propietarios
    ├── shared-mailboxes.test.js      # Buzones compartidos que puede abrir cada usuario
    ├── sign-in-report.test.js        # «No fui yo»: aviso, cierre de sesiones y su orden
    ├── rooms.test.js                 # Salas libres y enlace de reserva
    ├── help.test.js                  # Página de ayuda y formulario de contacto
    ├── requestStore.test.js          # Almacén de solicitudes
    ├── service-status.test.js        # Aviso de incidencias y su caché
    ├── csrf.test.js                  # Protección CSRF
    ├── auditService.test.js          # Registro de auditoría
    ├── reset-password.test.js        # Validación de la petición de restablecimiento
    ├── reset-password-flow.test.js   # Restablecimiento completo: enlace, caducidad, un solo uso, contraseña nueva
    ├── resetTokenService.test.js     # Token del enlace de restablecimiento
    ├── rate-limit.test.js            # Límites de las páginas de restablecimiento
    ├── token-refresh.test.js         # Tokens de acceso caducados y rechazados
    ├── tokenService.test.js          # MSAL real contra un Entra ID simulado
    ├── middleware.test.js            # Autenticación, permisos, rol de administrador
    ├── errorHandler.test.js          # Comportamiento de la página de error
    └── graphService.test.js          # Servicio de Microsoft Graph
```

---

## Parte 4: Tests

El proyecto usa **ava** para ejecutar los tests y **supertest** para manejar la aplicación Express.

### Ejecutar todos los tests

```bash
npm test
```

### Ejecutar un archivo o un test

```bash
NODE_ENV=test npx ava test/graphService.test.js
NODE_ENV=test npx ava --match='*reset link*'
```

### Ejecutar los tests en modo vigilancia (para desarrollar)

```bash
npm run test:watch
```

### Cómo funcionan los tests

Ningún test habla con Microsoft, AWS ni WordPress:

- `test/helpers/env.js` pone cada variable de entorno a un valor fijo de prueba, así que los archivos que lo cargan no necesitan (ni usan) un `.env` real.
- `test/helpers/stubs.js` sustituye axios, las llamadas de tokens de MSAL y el cliente de SES, y apunta lo que la aplicación ha intentado enviar.
- `test/authenticated.test.js` inicia sesión por la ruta real `/auth/callback` con MSAL simulado, y luego reutiliza la cookie de sesión.

### Qué está cubierto

- ✅ Rutas de OAuth: redirección de inicio de sesión, retorno, cierre de sesión
- ✅ Protección de rutas para usuarios anónimos, página de inicio de sesión, 404
- ✅ Perfil, edición del perfil, grupos, teams y organigrama con sesión iniciada
- ✅ `/api/users`, y los correos de corrección de responsable y de solicitud de acceso a grupos
- ✅ Blog: lista de usuarios permitidos, categorías, cuerpo del correo para Jetpack, adjuntos
- ✅ Restablecimiento de contraseña: misma respuesta para usuarios desconocidos, cabecera Host falsificada, enlaces caducados, usados y manipulados, límites de intentos, cambio de contraseña
- ✅ Tokens de acceso: renovación silenciosa, cierre de sesión cuando la renovación falla o Microsoft Graph rechaza el token
- ✅ Directorio, página de la cuenta (métodos de inicio de sesión, dispositivos), respuestas automáticas y subida de foto
- ✅ Solicitudes de grupos: envío a propietarios o al administrador, aprobación, rechazo, quién puede decidir
- ✅ Aviso de estado del servicio y su caché
- ✅ Qué incluye la licencia, la lista de comprobación de la cuenta, las reglas de la bandeja de entrada, mis grupos y mis inicios de sesión
- ✅ «No fui yo», calendario compartido, buzones compartidos, herramientas para propietarios, salas y página de ayuda
- ✅ Organigrama: construcción del árbol, cuentas que quedan fuera y nombres que no pueden inyectar HTML
- ✅ Configuración regional corregida al iniciar sesión, y que el inicio de sesión funciona cuando no se puede corregir
- ✅ Visor de auditoría: solo administradores, filtros, líneas dañadas
- ✅ Protección CSRF de cada formulario, subida y petición JSON
- ✅ Entradas del registro de auditoría, y que nunca contienen contraseñas, enlaces ni mensajes
- ✅ Middleware: autenticación, permisos, rol de administrador, páginas de error
- ✅ Servicio de Microsoft Graph: forma de la petición, paginación y tratamiento de errores de cada llamada
- ✅ Que las páginas no cargan estilos, scripts ni tipografías de otros servidores

### Cobertura

`npm run coverage` solo muestra un aviso: c8 no funciona en las versiones actuales de Node.js, así que por ahora no hay informe de cobertura.

---

## Parte 5: Variables de entorno

| Variable | Descripción | Ejemplo | Obligatoria |
|----------|-------------|---------|-------------|
| `CLIENT_ID` | Id. de aplicación (cliente) de Azure | `12345678-1234-...` | Sí |
| `CLIENT_SECRET` | Valor del secreto de cliente de Azure | `abc123...` | Sí |
| `TENANT_ID` | Id. de directorio (inquilino) de Azure | `87654321-4321-...` | Sí |
| `REDIRECT_URI` | URL de retorno de OAuth; también se usa para construir la URL tras cerrar sesión | `http://localhost:3000/auth/callback` | Sí |
| `SESSION_SECRET` | Cadena aleatoria que firma la cookie de sesión | Valor aleatorio generado | Sí |
| `TOKEN_SECRET` | Cadena aleatoria que cifra los enlaces de restablecimiento de contraseña | Valor aleatorio generado | Para restablecer contraseñas |
| `JETPACK_POST_BY_EMAIL` | Dirección de Publicar por correo de Jetpack a la que envía la página del blog | `user@post.wordpress.com` | Para el blog |
| `WP_URL` | URL del sitio WordPress (las categorías se leen de su API REST) | `https://example.es` | Para el blog |
| `WP_USER` | Usuario de WordPress para la API REST | `editor` | Para el blog |
| `WP_APP_PASSWORD` | Contraseña de aplicación de WordPress de ese usuario | Generada en WordPress | Para el blog |
| `AWS_REGION` | Región de AWS de la identidad de SES | `eu-west-1` | Para restablecer contraseñas |
| `AWS_ACCESS_KEY_ID` | Clave de acceso de AWS con permiso para enviar con SES | `AKIA...` | Para restablecer contraseñas |
| `AWS_SECRET_ACCESS_KEY` | Secreto de esa clave de acceso | | Para restablecer contraseñas |
| `FROM_EMAIL` | Remitente, verificado en SES, de los correos de restablecimiento | `no-responder@arandadeduero.dev` | Para restablecer contraseñas |
| `AUDIT_DIR` | Directorio del registro de auditoría | `/var/log/mi-microsoft-365` | No (por defecto: `./audit`) |
| `DATA_DIR` | Directorio de las solicitudes para entrar en grupos | `/var/lib/mi-microsoft-365` | No (por defecto: `./data`) |
| `PASSWORD_MAX_AGE_DAYS` | Días que dura una contraseña en tu inquilino; hace que la página de la cuenta muestre los días que quedan | `90` | No (no se muestra caducidad) |
| `PROFILE_EDITABLE_FIELDS` | Campos del perfil que los usuarios pueden cambiar por sí mismos, de entre `mobilePhone`, `businessPhones`, `jobTitle` y `officeLocation`; el resto se muestra en solo lectura | `mobilePhone,businessPhones` | No (por defecto: los cuatro) |
| `INTRANET_URL` | Dirección de la intranet de la organización, enlazada desde la página de inicio, la de ayuda y el pie | `https://example.sharepoint.com` | No (por defecto: la del Ayuntamiento) |
| `ORG_CHART_ROOT` | Dirección de la persona que está en lo alto del organigrama; las cuentas que no dependen de ella se listan debajo del gráfico | `top-person@example.com` | No (por defecto: la del Ayuntamiento; si nadie tiene esa dirección, quien tenga gente a su cargo y ningún responsable) |
| `ADMIN_EMAIL` | Buzón que recibe las correcciones de responsable, las solicitudes de acceso a grupos, los inicios de sesión denunciados y los mensajes de la página de ayuda | `informatica@example.es` | Recomendada (si falta se usa una dirección incluida en el código) |
| `TRUST_PROXY` | Número de proxies inversos delante de la aplicación, para que vea la dirección y el protocolo reales del cliente | `1` | Cuando hay un proxy delante |
| `RESET_RATE_LIMIT` | Enlaces de restablecimiento que una dirección IP puede pedir cada 15 minutos | `5` | No (por defecto: 5) |
| `PORT` | Puerto del servidor | `3000` | No (por defecto: 3000) |
| `NODE_ENV` | Modo de ejecución | `development` o `production` | No (por defecto: development) |

`REDIRECT_URI` decide también la dirección de los enlaces de restablecimiento de contraseña: apuntan a su origen (por ejemplo `https://herramientas.example.es`), nunca al host de la petición que llega.

Quién puede usar `/blog` no es una variable de entorno: se configura en `config/local.js` (ver Parte 2, Paso 4).

---

## Parte 6: Funcionamiento de la aplicación

### Flujo de autenticación

1. **El usuario entra en `/`** → No está autenticado → Se le lleva a `/login`
2. **El usuario pulsa «Iniciar sesión con Microsoft»** → Se le lleva a `/auth/signin`
3. **La aplicación genera la URL de autorización** → Redirige a la página de inicio de sesión de Microsoft
4. **El usuario inicia sesión** → Microsoft valida las credenciales
5. **Microsoft redirige a `/auth/callback`** con el código de autorización
6. **La aplicación cambia el código por un token de acceso** → Lo guarda en la sesión
7. **El usuario vuelve a `/`** → Ya está autenticado
8. **La aplicación pide los datos del usuario** a la API de Microsoft Graph:
   - Datos del perfil
   - Foto de perfil
   - Grupos a los que pertenece
   - Datos del responsable
9. **Se muestra la página de perfil**
10. **El usuario pulsa «Cerrar sesión»** → Se borra la sesión → Vuelve al inicio de sesión

### Rutas

| Método | Ruta | Acceso | Para qué |
|--------|------|--------|----------|
| GET | `/login` | Pública | Página de inicio de sesión |
| GET | `/auth/signin` | Pública | Redirige al inicio de sesión de Microsoft |
| GET | `/auth/callback` | Pública | Retorno de OAuth, crea la sesión |
| GET | `/auth/logout` | Pública | Destruye la sesión y cierra la de Microsoft |
| GET | `/` | Con sesión | Perfil |
| GET, POST | `/profile/me/edit` | Con sesión | Editar puesto, teléfonos y oficina |
| POST | `/profile/me/photo` | Con sesión | Subir una foto de perfil nueva (JPG o PNG, hasta 4 MB) |
| GET, POST | `/profile/me/auto-reply` | Con sesión | Respuestas automáticas (fuera de la oficina) |
| GET | `/account` | Con sesión | Qué tiene el usuario y cómo está configurada y protegida su cuenta |
| GET | `/account/groups` | Con sesión | Los grupos del usuario y qué le da cada uno |
| GET | `/account/sign-ins` | Con sesión | Los inicios de sesión recientes del propio usuario |
| POST | `/account/sign-ins/report` | Con sesión | «No fui yo»: avisa a Informática de un inicio de sesión y cierra todas las sesiones |
| GET | `/account/mailboxes` | Con sesión | Los buzones compartidos que el usuario puede abrir |
| GET | `/groups/owned` | Con sesión | Los grupos de los que el usuario es propietario |
| GET | `/groups/owned/:id` | Propietarios del grupo | Sus miembros, invitados y propietarios |
| POST | `/groups/owned/:id/members` | Propietarios del grupo | Añadir un miembro |
| POST | `/groups/owned/:id/members/:userId/remove` | Propietarios del grupo | Quitar un miembro |
| GET | `/salas` | Con sesión | Salas de reuniones libres a una hora dada |
| GET | `/ayuda` | Con sesión | Página de ayuda |
| POST | `/ayuda/contacto` | Con sesión | Escribir a Informática desde el buzón del usuario |
| GET | `/admin/audit` | Administradores | El registro de auditoría, con filtros |
| GET | `/directorio` | Con sesión | Directorio del personal |
| GET | `/groups` | Con sesión | Grupos del inquilino y listas de distribución (nombres que empiezan por `DIST`) |
| POST | `/groups/generate-report` | Con sesión | Informe en texto de los grupos seleccionados (JSON) |
| GET | `/teams` | Con sesión | Equipos a los que pertenece el usuario y sus canales |
| GET | `/organigrama` | Con sesión | Organigrama |
| GET | `/api/users` | Con sesión | Usuarios de la organización (JSON) |
| POST | `/api/manager-correction` | Con sesión | Envía por correo una corrección de responsable |
| POST | `/api/group-access-request` | Con sesión | Pide entrar en los grupos seleccionados |
| GET | `/groups/requests` | Con sesión | Solicitudes de los grupos de los que soy propietario, y las que he hecho yo |
| POST | `/groups/requests/:id/approve`, `/reject` | Propietario del grupo | Decidir sobre una solicitud |
| GET, POST | `/blog` | Con sesión y en la lista de permitidos | Publicar una entrada en WordPress por correo |
| GET, POST | `/reset-password` | Pública | Pedir un enlace para restablecer la contraseña |
| GET, POST | `/reset-password/:token` | Pública (enlace del correo) | Elegir una contraseña nueva |

### Gestión de sesiones

- Los tokens de acceso de Microsoft duran alrededor de una hora. La sesión guarda también la caché de tokens de MSAL (con el token de renovación), y la aplicación renueva el token de acceso poco antes de que caduque, así que los usuarios siguen con la sesión iniciada todo el tiempo que dura
- Si el token no se puede renovar, o Microsoft Graph lo rechaza (por ejemplo después de deshabilitar la cuenta), la sesión se vacía y el usuario vuelve a la página de inicio de sesión

- Las sesiones se guardan en archivos (se conservan aunque se reinicie el servidor)
- Las cookies de sesión son HTTP-only (protección frente a XSS)
- La marca Secure está activa en producción (solo HTTPS)
- SameSite=lax, más un token CSRF en cada formulario y en cada petición desde el navegador
- Duración de la sesión: 24 horas
- Las sesiones se guardan en el directorio `sessions/` (excluido de git)

---

## Parte 7: Uso de la API de Microsoft Graph

Todas las llamadas a Microsoft Graph están en `services/graphService.js`. Estas son las de la página de perfil; el resto de páginas (cuenta, grupos, salas, organigrama…) hacen las suyas, descritas más abajo.

### 1. Perfil del usuario (ampliado)

**Dirección:** `GET /v1.0/me`

**Campos que se piden:**
- `id`, `displayName`, `givenName`, `surname`
- `mail`, `userPrincipalName`
- `jobTitle`, `department`, `companyName`
- `officeLocation`, `employeeId`
- `mobilePhone`, `businessPhones`
- `preferredLanguage`

### 2. Foto de perfil

**Dirección:** `GET /v1.0/me/photo/$value`

Devuelve la imagen en binario. Si no hay foto, se usa el avatar por defecto.

### 3. Grupos a los que pertenece

**Dirección:** `GET /v1.0/me/memberOf`

Devuelve la lista de grupos a los que pertenece el usuario.

### 4. Responsable

**Dirección:** `GET /v1.0/me/manager`

Devuelve los datos del perfil del responsable. Si no hay responsable asignado, devuelve null.

Estas cuatro llamadas se hacen en paralelo para que la página cargue lo antes posible.

---

### Configuración regional

Todo el mundo trabaja en el mismo sitio, así que todas las cuentas se mantienen con la misma configuración. Cada vez que un usuario inicia sesión en esta aplicación, se comprueba y, donde difiera, se corrige:

| Ajuste | Valor | Afecta a |
|--------|-------|----------|
| Zona horaria del buzón | Madrid (`Romance Standard Time`) | Outlook, y el calendario que se ve en Teams |
| Idioma del buzón | Español (`es-ES`) | Outlook, nombres de las carpetas y fechas |
| Zona horaria del horario laboral | Madrid | Calendario y programación; se conservan los días y horas del propio usuario |
| Idioma preferido de la cuenta | Español (`es-ES`) | Las aplicaciones web de Microsoft 365, Teams incluido |

Lo que esto no puede hacer: no bloquea nada. Un usuario puede seguir cambiando un ajuste en Outlook, y se vuelve a poner la próxima vez que inicie sesión aquí, no antes. A los usuarios que nunca abren esta aplicación no se les corrige. La aplicación de escritorio de Teams sigue además el idioma y la zona horaria del propio ordenador, a los que la aplicación no llega. Cada corrección se apunta en el registro de auditoría. Los valores están en `config/appConfig.js`.

### Denunciar un inicio de sesión («No fui yo»)

Cada entrada de «Mis inicios de sesión» tiene un botón para el usuario que no la reconoce. La aplicación envía a `ADMIN_EMAIL` los datos de ese inicio de sesión (leídos de nuevo del registro, no tomados del navegador), cierra todas las sesiones de la cuenta en todos los dispositivos (`revokeSignInSessions`) y termina la sesión en esta aplicación. La página siguiente dice con honestidad cuál de los dos pasos ha funcionado y manda al usuario a cambiar su contraseña: cerrar las sesiones no sirve de nada si alguien la conoce. Los tokens ya emitidos pueden seguir siendo válidos hasta una hora.

### Campos del perfil que los usuarios no pueden cambiar

Cada inquilino deja a los usuarios editar unos campos distintos de su perfil, y las cuentas con un rol de administrador son todavía más estrictas. La aplicación envía cada campo cambiado por separado, guarda los que Microsoft acepta y muestra los rechazados en solo lectura durante el resto de la sesión, con «pide el cambio a Informática». Si ya sabes qué campos rechaza tu inquilino, configura `PROFILE_EDITABLE_FIELDS` para que estén en solo lectura desde el principio.

### Herramientas para propietarios

`/groups/owned` lista los grupos de los que es propietario el usuario con sesión iniciada y señala aquellos en los que es el único propietario. La página de cada grupo muestra sus miembros, marca a los invitados externos y deja al propietario añadir o quitar miembros con su propio token, de modo que la aplicación no puede hacer nada que el propietario no pudiera hacer en Outlook o en Teams. Las listas de distribución y los grupos de seguridad con correo se muestran pero no se pueden cambiar, porque Microsoft Graph no puede cambiarlos. Los propietarios no se gestionan aquí.

### Organigrama

`/organigrama` dibuja quién depende de quién a partir del responsable que figura en el perfil de cada persona, con una sola consulta al directorio. Arriba está la persona indicada en `ORG_CHART_ROOT`; las cuentas que no dependen de ella (buzones, cuentas de servicio, quien no tiene responsable puesto) se listan debajo del gráfico en lugar de desaparecer. El buscador encuentra por nombre, puesto, departamento o correo, sin distinguir acentos, y lleva hasta la tarjeta o hasta la fila de esa lista. Las tarjetas muestran las iniciales como texto: no se pide ninguna imagen ni se envía ningún nombre a otro servidor.

### Salas

`/salas` lista las salas de reuniones con dónde están y su aforo (la tabla se ordena pulsando las cabeceras) y, al indicar un día y una hora, muestra cuáles están libres. Solo consulta: «Reservar en Outlook» abre una reunión nueva con la sala y la hora ya puestas, y la sala queda reservada cuando el usuario la envía. Hace falta que las salas existan como buzones de sala en Exchange.

### Visor de auditoría

Los usuarios que tienen un rol de directorio de Entra ID (los mismos que ven el aviso rojo ADMIN) tienen una entrada «Auditoría» en el menú. `/admin/audit` muestra los últimos siete días del registro de auditoría, lo más reciente primero, y se puede acotar a un día, a un tipo de evento o a una persona. Vale cualquier rol de directorio, no solo el de Administrador global.

### Solicitudes de grupos

Cuando un usuario pide entrar en grupos desde la página de grupos, cada grupo se trata por separado:

- **Grupos de Microsoft 365 y grupos de seguridad que tienen propietarios**: se guarda una solicitud pendiente y los propietarios reciben un correo con un enlace a `/groups/requests`. Cualquier propietario puede aprobarla o rechazarla ahí. Al aprobarla, la persona entra en el grupo en ese momento, con los permisos del propio propietario, y en cualquiera de los dos casos se avisa por correo a quien la pidió.
- **Grupos sin propietarios, listas de distribución y grupos de seguridad con correo**: van a `ADMIN_EMAIL` en un solo correo, como antes. Microsoft Graph no puede cambiar los miembros de las listas que se gestionan en Exchange, así que sus propietarios no podrían aprobar aquí.

Las solicitudes se guardan en `DATA_DIR/group-requests.json` y nunca se borran, para que cada usuario pueda ver en qué quedó la suya. La aplicación está pensada para ejecutarse en una sola instancia; varias instancias compartiendo ese archivo se pisarían unas a otras.

### Estado del servicio

Mientras Microsoft informa de una incidencia abierta en cualquier servicio de Microsoft 365, los usuarios con sesión iniciada ven arriba, en todas las páginas, un aviso con el servicio y una descripción breve. Los avisos informativos (advisories) no se muestran. La lista se lee como mucho una vez cada cinco minutos y es la misma para todos los usuarios. Si no se puede leer, no se muestra ningún aviso y el siguiente intento es una hora después.

### Registro de auditoría

Cada acción que cambia algo, y cada inicio de sesión, se añade a un archivo por día en `AUDIT_DIR` (`./audit` por defecto), un objeto JSON por línea:

```json
{"time":"2026-10-10T15:04:05.123Z","event":"profile.update","actor":"usuario@arandadeduero.es","ip":"203.0.113.5","fields":["mobilePhone"]}
```

| Evento | Se apunta cuando |
|--------|------------------|
| `auth.sign_in`, `auth.sign_out` | Un usuario inicia o cierra sesión |
| `account.regional_settings_corrected` | Se ha vuelto a poner la zona horaria o el idioma al iniciar sesión (qué ajustes) |
| `permission.denied` | A un usuario se le niega una página: la lista de permitidos del blog, el visor de auditoría, o decidir sobre una solicitud de un grupo del que no es propietario |
| `profile.update`, `profile.photo_update` | Cambian los datos o la foto del perfil |
| `mail.auto_reply_update` | Cambian las respuestas automáticas (solo el estado, nunca el mensaje) |
| `account.sign_in_reported` | Un usuario ha denunciado un inicio de sesión como ajeno (su id y su dirección, si se avisó a Informática y si se cerraron las sesiones) |
| `group.member_added`, `group.member_removed` | Un propietario ha cambiado los miembros de su grupo |
| `help.contact` | Un usuario ha escrito a Informática desde la página de ayuda (nunca el mensaje) |
| `request.manager_correction`, `request.group_access` | Se envía una solicitud por correo al buzón de administración |
| `group_request.created`, `group_request.approved`, `group_request.rejected` | Se envía a los propietarios una solicitud para entrar en un grupo, y lo que deciden |
| `blog.post` | Se envía una entrada a WordPress (título, estado, número de adjuntos) |
| `reset.link_requested` | Se pide un enlace de restablecimiento: la dirección y si fue a la dirección alternativa (`alternate`), al buzón (`mailbox`) o a nadie (`nobody`) |
| `reset.link_failed` | No se pudo enviar el enlace |
| `reset.password_changed`, `reset.rejected` | Se restablece una contraseña, o se rechaza un intento |

Nunca se escriben contraseñas, enlaces de restablecimiento ni el contenido de los mensajes. La aplicación solo añade líneas; rotar o archivar los archivos antiguos es cosa tuya. Si no se puede escribir en el registro, la acción sigue adelante y el fallo queda en el registro del servidor.

```bash
# ¿Quién ha restablecido una contraseña este mes?
grep -h '"reset.password_changed"' audit/2026-10-*.log
```

---

## Parte 8: Tratamiento de errores

Las páginas informan de los errores con una única plantilla, `views/error.ejs`, que muestra el código de estado HTTP, un mensaje y un enlace para volver al inicio.

- **Fuera de producción** el mensaje es el mensaje real del error.
- **En producción** (`NODE_ENV=production`) el mensaje es siempre un texto genérico, «Lo sentimos, ha ocurrido un error».

La traza, la URL y el método se escriben en el registro del servidor en los dos modos y nunca se envían al navegador.

Algunas direcciones responden de otra forma:

- `/api/*` devuelve JSON: `{ "success": false, "error": "..." }`
- Un `POST /blog` fallido y una comprobación de permisos denegada responden en texto plano

Hay dos casos que no se tratan como errores sin más:

- Los mensajes escritos para el usuario (un enlace de restablecimiento caducado o ya usado, demasiados intentos, contraseñas que no coinciden) se muestran también en producción.
- Cuando Microsoft Graph responde 401 para el usuario con sesión iniciada, se le lleva a la página de inicio de sesión en lugar de mostrarle un error.

---

## Parte 9: Despliegue en Heroku

### Requisitos previos

1. Instala la CLI de Heroku:

```bash
npm install -g heroku
```

2. Crea una cuenta de Heroku en [heroku.com](https://heroku.com)

### Pasos del despliegue

#### 1. Iniciar sesión en Heroku

```bash
heroku login
```

#### 2. Crear la aplicación en Heroku

```bash
# Deja que Heroku genere un nombre
heroku create

# O indica el tuyo
heroku create mi-microsoft-365
```

Apunta la URL de la aplicación (por ejemplo `https://mysterious-ocean-12345.herokuapp.com`)

#### 3. Configurar las variables de entorno

```bash
heroku config:set CLIENT_ID=your-client-id-from-azure
heroku config:set CLIENT_SECRET=your-client-secret-from-azure
heroku config:set TENANT_ID=your-tenant-id-from-azure
heroku config:set SESSION_SECRET=$(openssl rand -base64 32)
heroku config:set NODE_ENV=production
heroku config:set REDIRECT_URI=https://your-app-name.herokuapp.com/auth/callback
```

Cambia `your-app-name` por el nombre real de tu aplicación en Heroku.

#### 4. Desplegar en Heroku

```bash
git add .
git commit -m "Ready for Heroku deployment"
git push heroku main
```

O, si tu rama es `master`:

```bash
git push heroku master
```

#### 5. Abrir la aplicación

```bash
heroku open
```

#### 6. Ver los registros (si hace falta)

```bash
heroku logs --tail
```

### Después de desplegar: actualizar la URI de redirección en Azure

**IMPORTANTE:** Después de desplegar en Heroku tienes que actualizar el registro de la aplicación en Azure:

1. Ve a [Azure Portal](https://portal.azure.com)
2. Entra en el registro de tu aplicación
3. Ve a **Autenticación**
4. En **Configuraciones de plataforma** → **Web**
5. Pulsa **Agregar URI**
6. Añade: `https://your-app-name.herokuapp.com/auth/callback`
7. Pulsa **Guardar**

¡Ya puedes probar el despliegue de producción!

---

## Parte 10: Otras formas de desplegar

### Docker

Cada push a `main` construye el `Dockerfile` y publica la imagen en GitHub Container Registry (`.github/workflows/docker-publish.yml`), con las etiquetas `latest` y `sha-<commit>`.

En producción, con `docker-compose.yml` (en el repositorio) y un `.env` al lado con los valores reales:

```bash
docker compose pull && docker compose up -d
docker compose logs -f
```

El compose arranca la imagen de GHCR con `NODE_ENV=production` y `TRUST_PROXY=1`, guarda `sessions/`, `audit/` y `data/` en volúmenes con nombre, publica el puerto solo en `127.0.0.1:3000` (para un proxy inverso con TLS en la misma máquina) y comprueba la salud con `/login`. Para actualizar, repite `pull` y `up -d`. Si usas la lista de permitidos del blog o los buzones compartidos, descomenta en el compose el montaje de `config/local.js`.

Para construir la imagen en local:

```bash
docker build -t mi-microsoft-365 .
```

Notas:

- `.env` y `config/local.js` no forman parte de la imagen (los dos están en `.dockerignore`), así que pasa el entorno al ejecutar (el compose lee `.env`) y monta `config/local.js` si usas la lista de permitidos del blog.
- El registro de auditoría se escribe en `audit/` y las solicitudes de grupos pendientes en `data/`. Sin volúmenes se pierden con el contenedor.
- Las sesiones son archivos en `sessions/`. Sin un volumen, todo el mundo pierde la sesión cuando se sustituye el contenedor. Lo mismo pasa en las plataformas con sistema de archivos efímero, como Heroku.
- En producción la cookie de sesión es `Secure`, así que hay que llegar a la aplicación por HTTPS, y la aplicación envía HSTS.
- El proceso corre como el usuario `node` (uid 1000), no como root. Si montas directorios del host en `sessions/`, `audit/` o `data/`, tienen que ser escribibles por ese uid; los volúmenes con nombre toman el propietario de la imagen la primera vez.
- Sin `SESSION_SECRET` la aplicación no arranca en producción.
- Detrás de un proxy inverso, pon `TRUST_PROXY=1`. Si no, todos los visitantes parecen venir de la dirección del proxy y comparten un único límite de restablecimiento de contraseña.
- Los contadores de los límites se guardan en memoria, así que se reinician con el contenedor y no se comparten entre varias instancias.

### Render.com

1. Crea una cuenta en [render.com](https://render.com)
2. Conecta tu repositorio de GitHub
3. Crea un Web Service nuevo
4. Configura las variables de entorno en el panel
5. Despliega

### Railway.app

1. Crea una cuenta en [railway.app](https://railway.app)
2. Crea un proyecto nuevo a partir de GitHub
3. Configura las variables de entorno
4. Se despliega automáticamente

### Azure App Service

1. Crea un App Service en Azure Portal
2. Elige el entorno de ejecución Node.js
3. Despliega desde GitHub o desde un git local
4. Configura las variables de entorno en Configuración
5. La URI de redirección estará en el mismo dominio que Azure AD

### DigitalOcean App Platform

1. Crea una cuenta en [digitalocean.com](https://digitalocean.com)
2. Crea una aplicación nueva a partir de GitHub
3. Configura las variables de entorno
4. Despliega

---

## Parte 11: Seguridad

### Tokens

- ✅ Los tokens de acceso se guardan solo en el servidor (en la sesión)
- ✅ Nunca llegan al JavaScript del navegador
- ✅ Los tokens no se guardan en cookies
- ✅ Las cookies de sesión son HTTP-only
- ✅ Las sesiones se conservan aunque se reinicie el servidor (se guardan en archivos)

### Secretos

- ✅ El secreto de cliente nunca se sube a git
- ✅ Variables de entorno para todos los datos sensibles
- ✅ El archivo `.env` está en `.gitignore`
- ✅ Secretos distintos para desarrollo y producción
- ✅ Sin `SESSION_SECRET` la aplicación no arranca en producción; fuera de ella usa un secreto aleatorio por proceso

### Sesiones

- ✅ Secreto de sesión aleatorio y seguro
- ✅ Cookies HTTP-only (protección frente a XSS)
- ✅ Marca Secure en producción (solo HTTPS)
- ✅ SameSite=lax
- ✅ Token CSRF obligatorio en cada petición que cambia algo
- ✅ Sesión de 24 horas

### HTTPS

- ✅ Obligatorio en producción
- ✅ Heroku lo proporciona automáticamente
- ✅ Las cookies seguras solo funcionan por HTTPS

### Cabeceras

- ✅ `Content-Security-Policy` que solo permite recursos del propio servidor y prohíbe mostrar las páginas dentro de otras (`frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` y HSTS en producción (`middleware/securityHeaders.js`)

### Recursos externos

- ✅ Las páginas no cargan estilos, scripts, tipografías ni imágenes de otros servidores: Bootstrap, la tipografía Outfit y las librerías del organigrama están en `public/vendor/` (versiones, origen y licencias en su `README.md`)
- ✅ Las iniciales de las tarjetas del organigrama son texto: los nombres del personal no se envían a ningún servicio de avatares

### Buenas prácticas

1. **Cambia los secretos con regularidad** - Crea secretos de cliente nuevos en Azure cada 6-12 meses
2. **Usa HTTPS** - Siempre HTTPS en producción
3. **Valida las URI de redirección** - Autoriza en Azure solo tus URI reales
4. **Vigila los registros** - Busca patrones de autenticación fuera de lo normal
5. **Mantén las dependencias al día** - Ejecuta `npm audit` con regularidad

---

## Parte 12: Solución de problemas

### Problema: aviso «Missing required environment variables»

**Solución:** Comprueba que has creado un archivo `.env` con todas las variables obligatorias:

```bash
cp .env.example .env
# Luego edita .env con tus valores reales
```

### Problema: la autenticación falla con el error «invalid_client»

**Causas posibles:**
1. `CLIENT_ID` o `CLIENT_SECRET` incorrectos
2. El secreto de cliente ha caducado
3. `TENANT_ID` incorrecto

**Solución:** Compara los valores de tu `.env` con los de Azure Portal

### Problema: error «Redirect URI mismatch»

**Solución:** Comprueba que `REDIRECT_URI` en tu `.env` coincide exactamente con la URI de redirección configurada en Azure:

- En local: `http://localhost:3000/auth/callback`
- Heroku: `https://your-app-name.herokuapp.com/auth/callback`

### Problema: error «Insufficient permissions»

**Solución:** 
1. Ve a Azure Portal → tu aplicación → Permisos de API
2. Comprueba que están añadidos todos los permisos necesarios
3. Pulsa «Conceder consentimiento de administrador»

### Problema: no se ve la foto de perfil

**Causas posibles:**
1. El usuario no tiene foto de perfil en Microsoft 365
2. No se ha concedido el permiso `User.Read`

**Solución:** Es normal. La aplicación muestra un avatar por defecto si no hay foto.

### Problema: no llega el correo de restablecimiento de contraseña

La página responde siempre que se ha enviado un enlace si la dirección pertenece a una cuenta, pertenezca o no, así que la respuesta no dice qué ha pasado. El registro del servidor sí.

**Causas posibles:**
1. El correo está en la carpeta de correo no deseado
2. La dirección no pertenece a ninguna cuenta
3. AWS SES no está bien configurado (busca `Error sending reset link` en el registro)
4. Al registro de la aplicación le faltan los permisos de aplicación que necesita el restablecimiento
5. El directorio no devuelve `lastPasswordChangeDateTime` para la cuenta (el registro dice `reset.link_failed` con ese nombre): sin esa fecha el enlace no sería de un solo uso, así que no se envía

**Solución:**
1. Mira en la carpeta de correo no deseado si hay correos de la dirección `FROM_EMAIL`
2. Comprueba la dirección y las credenciales de AWS SES en `.env`
3. Fuera de producción, el enlace se escribe también en el registro del servidor

### Problema: un enlace de restablecimiento dice «El enlace ya ha sido utilizado»

Un enlace funciona una sola vez: deja de funcionar en cuanto cambia la contraseña de la cuenta, la cambie esta aplicación o cualquier otra. Pide un enlace nuevo. Los enlaces caducan además a los 15 minutos.

### Problema: «Demasiados intentos» en las páginas de restablecimiento de contraseña

Una dirección IP puede pedir 5 enlaces y hacer 20 intentos con enlaces cada 15 minutos (`RESET_RATE_LIMIT` cambia las dos cosas). Si todo el mundo llega al límite a la vez, la aplicación está detrás de un proxy y `TRUST_PROXY` no está configurado.

### Problema: el puerto 3000 ya está en uso

**Solución:** Cambia el puerto en `.env`:

```env
PORT=3001
```

### Problema: los tests fallan

**Solución:** Los tests ponen su propio entorno y no necesitan un archivo `.env`. Comprueba que las dependencias están instaladas (`npm ci`) y que usas Node.js 25 o posterior (`node --version`).

### Problema: un formulario responde «El formulario ha caducado»

El token CSRF del formulario ya no coincide con la sesión, normalmente porque la sesión ha caducado o porque la página se quedó abierta mientras se cerraba la sesión. Recarga la página y envíalo otra vez.

### Problema: el restablecimiento de contraseña falla y el registro dice «TOKEN_SECRET is not configured»

**Solución:** Falta `TOKEN_SECRET` en `.env`. Genera uno con `openssl rand -base64 32`. El servidor avisa de ello al arrancar.

### Problema: `/blog` responde «Access Denied»

**Solución:** Tu nombre de usuario no está en la lista de permitidos. Añádelo a `'/blog'` en `config/local.js` (ver Parte 2, Paso 4) y reinicia el servidor. Solo se aceptan cuentas del dominio configurado.

---

## Parte 13: Consejos para desarrollar

### Recarga automática

El servidor de desarrollo usa nodemon para reiniciarse solo:

```bash
npm run dev
```

Los cambios en estos archivos provocan un reinicio:
- Archivos `*.js` de la raíz, routes, middleware, services y config
- Archivos `*.ejs` de views
- Archivos `*.css`

### Ver los registros

En modo desarrollo se registran todas las peticiones:

```
GET /
GET /css/custom.css
GET /auth/signin
```

### Probar la autenticación en local

1. Comprueba que entre las URI de redirección de Azure está `http://localhost:3000/auth/callback`
2. Arranca el servidor de desarrollo: `npm run dev`
3. Abre `http://localhost:3000`
4. Inicia sesión con tu cuenta de M365
5. Mira la pestaña de red del navegador para depurar el flujo de autenticación

### Depurar

Añade puntos de interrupción o sentencias console.log:

```javascript
// En routes/index.js
console.log('User data:', userData);
```

---

## Parte 14: Interfaz y estilos

La aplicación usa **Bootstrap 5** junto con CSS propio y variables para conseguir una interfaz moderna y adaptable, en la línea de las aplicaciones web corporativas.

### Elementos de diseño

- **Tipografía**: `Outfit`, servida por la propia aplicación desde `public/vendor/fonts/` (no se carga de Google Fonts).
- **Paneles**: clases `.app-panel` con sombras suaves y un borde superior de color según la sección en la que se está.
- **Diseño adaptable**: la rejilla de Bootstrap hace que la interfaz funcione bien tanto en ordenador como en móvil.
- **Fondos dinámicos**: degradados radiales en CSS a juego con el color de cada página.

### Personalización

Edita `public/css/custom.css` para cambiar la paleta primaria/secundaria y los colores de acento:

```css
:root {
  --app-ink: #182433;
  --app-muted: #5a6678;
  --app-primary: #0d6efd;
  --app-secondary: #f59f00;
  --app-surface: #ffffff;
}
```

### Documentación

- [Documentación de Bootstrap 5](https://getbootstrap.com/docs/5.3/getting-started/introduction/)

---

## Parte 15: Contribuir

Si quieres contribuir:

1. Haz un fork del repositorio
2. Crea una rama para tu cambio: `git checkout -b feature/my-feature`
3. Haz tus cambios
4. Ejecuta los tests: `npm test`
5. Haz commit: `git commit -m "Add my feature"`
6. Sube la rama: `git push origin feature/my-feature`
7. Abre una Pull Request

---

## Parte 16: Licencia

Licencia MIT. El texto con valor legal es el original en inglés:

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Parte 17: Más recursos

### Documentación de Microsoft

- [API de Microsoft Graph](https://learn.microsoft.com/es-es/graph/)
- [MSAL Node.js](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-node-migration)
- [Entra ID (Azure AD)](https://learn.microsoft.com/en-us/azure/active-directory/)

### Bootstrap y CSS

- [Bootstrap 5](https://getbootstrap.com)
- [Documentación de Bootstrap 5](https://getbootstrap.com/docs/5.3/)

### Node.js y Express

- [Documentación de Node.js](https://nodejs.org/docs)
- [Guía de Express.js](https://expressjs.com/en/guide/routing.html)
- [Documentación de EJS](https://ejs.co)

---

## ¿Dudas o problemas?

Si te encuentras con algún problema o tienes preguntas:

1. Mira la sección [Solución de problemas](#parte-12-solución-de-problemas)
2. Revisa tus variables de entorno
3. Revisa la configuración en Azure Portal
4. Mira los registros del servidor: `heroku logs --tail` (en Heroku)

---

**¡Feliz programación!** 🚀
