# Panel de accesos Confeccionarte

Portal React + Firebase para administrar permisos de Auditorías, Estado de tallas e Inspección de telas. El administrador `grupocontable2130@gmail.com` gestiona los permisos; cada persona registrada ve solo los aplicativos que tiene habilitados.

## Inicio de sesión compartido

El portal vive en `/`, Auditorías en `/auditorias/`, Estado de tallas en `/tallas/` e Inspección de telas en `/telas/`, todo en el mismo dominio. Así Firebase Authentication comparte la sesión y Tallas/Telas vuelven al portal si alguien las abre sin iniciar sesión. El código de Auditorías no se modifica con esta integración.

Para publicar en Render, usa un único **Static Site** para este proyecto. El archivo `render.yaml` contiene el comando de compilación y las rutas de `/auditorias/`; si el servicio ya existe, sincroniza el Blueprint o configura las reglas en Settings → Redirects/Rewrites:

- Build command: `npm install && npm --prefix apps/auditorias ci && npm --prefix apps/tallas ci && npm --prefix apps/telas ci && npm run build`
- Publish directory: `dist`
- Rewrite route: `/auditorias` → `/auditorias/index.html`
- Rewrite route: `/auditorias/*` → `/auditorias/index.html`
- Rewrite route: `/tallas` → `/tallas/index.html`
- Rewrite route: `/tallas/*` → `/tallas/index.html`
- Rewrite route: `/telas` → `/telas/index.html`
- Rewrite route: `/telas/*` → `/telas/index.html`
- Rewrite route: `/*` → `/index.html`

Pon las rutas de `/auditorias`, `/tallas` y `/telas` antes de la regla general `/*`. El build genera el portal en `dist/`, Auditorías en `dist/auditorias/`, Tallas en `dist/tallas/` y Telas en `dist/telas/`.

En Firebase Authentication, habilita **Correo/contraseña** y autoriza el dominio del portal. Los tres módulos usan el mismo proyecto Firebase y origen web.

## Firebase y permisos

1. Usa el proyecto Firebase existente `crearte-by-confeccionart-6febe`; no crees otro.
2. El panel y Tallas usan la configuración web del proyecto compartido en sus archivos `src/firebase.js`; no pongas claves privadas de cuenta de servicio en variables `VITE_*`.
3. Publica `firestore.rules`. `firebase.json` y `.firebaserc` dejan seleccionado el proyecto correcto. Desde la raíz del repositorio, ejecuta `firebase login` y luego `firebase deploy --only firestore:rules`. Esto reemplaza las reglas activas de Firestore por las de este repositorio.
4. Inicia sesión con la cuenta administradora y agrega el correo antes o después del registro. La persona debe registrarse con ese mismo correo; los cambios de permisos aparecen en el portal en tiempo real, sin crear otra cuenta.

Los permisos se guardan en `app_access/{correo}` con las llaves `crearte`, `tallas` y `telas` (la llave `crearte` es interna y sigue siendo la que habilita Auditorías). Tallas y Telas abren dentro del portal en `/tallas/` y `/telas/`.

### Publicación de Estado de tallas y guardado de registros

El código integrado está en `apps/tallas` y `apps/telas`. Los servicios independientes de Tallas y Telas ya no se usan desde el panel. Render publica ambos junto con el portal desde el Blueprint de este repositorio. Sus configuraciones Firebase apuntan al proyecto compartido; no necesitan variables `VITE_FIREBASE_*`.

La versión antigua del ZIP guardaba todos los datos juntos en `appData/estado-set-de-tallas`, sin propietario por usuario. El código integrado usa Authentication y `app_records`, compatible con las reglas del panel.

La implementación integrada usa Firebase Authentication y guarda cada set y el plano como documentos en `app_records`, etiquetados con `appId: "tallas"`, `recordType`, `ownerUid` y `ownerEmail`. Las reglas de `firestore.rules` permiten a cada cuenta con acceso a Tallas leer y modificar solo sus propios documentos; el administrador puede consultar todos. Publica esas reglas en la base de datos Firestore del proyecto `crearte-by-confeccionart-6febe` (Firebase Console → Firestore Database → Rules o `firebase deploy --only firestore:rules`). Luego concede acceso `tallas` a cada correo desde el panel y verifica que la cuenta use ese mismo correo al iniciar sesión. Los registros históricos guardados localmente se migran a `app_records` al cargarse con esa cuenta.

## Desarrollo local

```bash
npm install
npm --prefix apps/auditorias ci
npm run dev
```

El servidor Vite del portal no monta automáticamente la salida de `/auditorias/` durante desarrollo. Para probar el build combinado, ejecuta:

```bash
npm run build
npm run preview
```

La configuración web y su API key identifican las apps de navegador; los permisos reales los aplican las reglas de Firestore. No uses una clave privada de cuenta de servicio en el navegador.
