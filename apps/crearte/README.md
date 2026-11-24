# Crearte By Confeccionarte

Aplicación web para registrar auditorías de calidad de confección. Permite calcular un plan de muestreo AQL, anotar defectos y segundas, guardar el historial y generar reportes para compartir.

Para consultar cómo funciona cada módulo y cómo se conectan sus archivos, revisa la [guía completa del código](./DOCUMENTACION_CODIGO.md). El código también incluye comentarios junto a sus secciones y reglas importantes.

El recorrido está disponible como [diagrama gráfico SVG](./DIAGRAMA_FLUJO.svg) y en la [página explicativa del diagrama](./DIAGRAMA_FLUJO.md).

## Requisitos

- Node.js y npm.
- Un proyecto Firebase con Authentication (correo y contraseña) y Cloud Firestore habilitados.
- Configuración de EmailJS si se van a enviar reportes por correo.

## Iniciar el proyecto

```bash
npm install
npm run dev
```

Vite muestra en la terminal la dirección local para abrir en el navegador. Para generar una compilación de producción:

```bash
npm run build
npm run preview
```

El proyecto no define actualmente un comando de pruebas automatizadas.

## Flujo de uso

1. Iniciar sesión en el portal de accesos y abrir Crearte desde el aplicativo autorizado. Crearte comparte la sesión de Firebase y valida el permiso `crearte` antes de mostrar el módulo.
2. Completar los datos del lote y los parámetros de inspección. La aplicación calcula el muestreo y el dictamen conforme a las tablas AQL incluidas en `src/App.jsx`.
3. Registrar defectos, segundas, observaciones y fotos de evidencia.
4. Guardar la auditoría y, si se requiere, consultar el historial, exportar un archivo Excel, descargar el reporte PDF o enviar el reporte por correo.

## Estructura principal

| Archivo | Responsabilidad |
| --- | --- |
| `src/main.jsx` | Punto de entrada: monta React y carga los estilos globales. |
| `src/App.jsx` | Interfaz principal, formulario e historial de auditorías, cálculo AQL, exportaciones y envío de correo. |
| `src/firebase.js` | Reexporta la instancia compartida de Firebase del portal. |
| `src/db.js` | Lectura, escritura y eliminación de auditorías en Cloud Firestore; también determina el rol de administrador. |
| `src/reportepdf.js` | Construcción del reporte PDF con datos de auditoría y evidencia fotográfica disponible. |
| `src/index.css` | Estilos globales y ajustes de interfaz para dispositivos móviles. |
| `tailwind.config.js` | Archivos escaneados y tema de Tailwind. |
| `postcss.config.js` | Integración de Tailwind CSS y Autoprefixer con PostCSS. |
| `vite.config.js` | Configuración del servidor de desarrollo y compilación con Vite. |
| `index.html` | Documento HTML inicial de la aplicación. |

## Servicios y datos

- La configuración cliente de Firebase se encuentra en `src/firebase.js`. Firebase Authentication debe permitir el proveedor de correo y contraseña; el módulo de datos utiliza la colección `auditorias` en Firestore.
- El historial se conserva en `localStorage` del navegador y se sincroniza con Firestore. El almacenamiento local usa la clave `auditorias_textil_local_db`.
- Las fotos se comprimen en el navegador antes de guardarse localmente. `src/db.js` excluye los datos de imagen al escribir en Firestore y guarda el número de fotos; el documento remoto no contiene las imágenes.
- La comparación de administrador en `src/db.js` es una comprobación de interfaz. Las reglas de seguridad de Firestore deben aplicar los permisos reales en el servidor y no depender de esa comprobación.
- El envío de correos usa EmailJS; sus identificadores y la plantilla se configuran actualmente en `src/App.jsx`. Configura y verifica la plantilla correspondiente en EmailJS.
- La sesión la administra el portal de accesos con Firebase Authentication; Crearte valida la sesión y el permiso antes de mostrar el módulo.

## Consideraciones de seguridad

La configuración web de Firebase y las claves públicas de servicios del navegador no sustituyen controles de acceso. Restringe las claves según las recomendaciones del proveedor y define reglas de Firestore que autentiquen al usuario y limiten el acceso a sus datos. No publiques credenciales privadas ni incluyas secretos de servidor en el código del cliente.
