# Política de seguridad

Este portal lo usa el personal del Ayuntamiento de Aranda de Duero con sus cuentas de Microsoft 365, así que un fallo de seguridad puede afectar a datos personales. Si encuentras uno, gracias por decírnoslo con discreción.

## Cómo avisar

- Usa **Report a vulnerability** en la pestaña [Security](https://github.com/arandadeduero/mi-microsoft-365/security/advisories/new) de este repositorio. El informe es privado: solo lo ven los responsables del proyecto.
- No abras una *issue* pública ni publiques detalles hasta que esté corregido.
- Cuenta qué has encontrado, cómo reproducirlo y qué efecto tiene. No hace falta que pruebes nada contra la instalación real del Ayuntamiento: con el código y una instalación propia basta.

Respondemos en cuanto podemos, normalmente en pocos días, y te decimos qué vamos a hacer y cuándo.

## Qué cubre

La rama `main` y la imagen Docker publicada desde ella. Las dependencias las vigila Dependabot y el código, CodeQL, en cada cambio.

## Lo que ya está pensado

En el README, parte 11, se explica cómo se protegen los tokens, las sesiones, los formularios (CSRF) y el restablecimiento de contraseña, y por qué las páginas no cargan nada de otros servidores.
