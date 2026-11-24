# Cotizador Web — MVP

Primera versión funcional del cotizador de prendas, derivada de `COTIZADOR DE MUESTRAS.xlsm`.

> Para usar el cotizador día a día sin conocimientos técnicos, consulte **[OPERACION.md](OPERACION.md)** (encendido, copias, restauración y problemas comunes).

## Cómo iniciar

1. Abrir una terminal en esta carpeta.
2. Ejecutar:

```bat
node src/server.js
```

O hacer doble clic en **`INICIAR.bat`**.

3. Abrir en el navegador: **http://localhost:3100** o la IP de la red, por ejemplo **http://192.168.10.97:3100** (la IP la detecta el servidor automáticamente).

Para detenerlo: `Ctrl + C`.

## Requisitos

- Node.js 20.18.0 (rango soportado: 20.x; ver `.node-version` y `engines` en `package.json`).
- Instalar dependencias una vez con `npm install` (solo `exceljs`).
- **El Excel del historial se genera en Node**, así que no necesita Microsoft Excel ni PowerShell.
- Microsoft Excel solo es necesario si se usa la vista **Importar** desde Windows; en Linux/Render esa vista queda deshabilitada.
- Para enviar correos solo se necesita conexión a internet: se usa EmailJS con una cuenta propia del cotizador, sin contraseña de correo.

## Qué incluye esta primera versión

- Catálogo de **568 operaciones** importadas desde `Base_operaciones`.
- **193 referencias** importadas desde `BD Referencias`.
- Parámetros del Excel (suplemento 15%, **Valor minuto confeccion**, **Valor minuto terminacion**, costo de empaque, complejidad 1,08 y utilidad 10%) editables en la sección *Cotizar*, en la tarjeta *Parámetros de cotización* ubicada antes de *Operaciones*. Esos mismos nombres aparecen en la columna *Parámetros usados* del resumen/Excel y en las columnas individuales del Excel.
- Cálculo en tiempo real de SAM por operación, totales por bloque, costo y precio sugerido.
- Botón **Calcular**, que vuelve a ejecutar la lógica en el servidor como verificación.
- Guardado de cotizaciones en `data/store.json` (historial consultable y eliminable).
- Búsqueda de referencias por código, descripción o tipo.
- **Marca por referencia**: editable en la tabla *Datos de referencia* (columna *Marca*, se guarda al cambiar el valor). Al escribir el código de una referencia en *Cotizar*, la marca se completa automáticamente, pero se puede modificar antes de guardar la cotización.
- **Vista Importar**: permite subir otro `.xlsm/.xlsx` y reemplazar todos los datos. Antes de reemplazar guarda copias en `data/catalog.anterior.json` y `data/store.anterior.json`, e incluye botones para **limpiar datos actuales** y **restaurar la copia anterior**. Opción para conservar o eliminar las cotizaciones guardadas.
- **Vista Correo**: genera un Excel **solo de las cotizaciones seleccionadas en el Historial** y envía por **EmailJS** un resumen con una tabla única (referencia, descripción, tipo, **marca**, operaciones, SAM, costo y precio, con subtotales y total), un resumen **por marca** y un enlace a una página de descarga que funciona sin instalar nada. El Excel tiene 3 hojas: *Resumen*, *Cotizaciones* y *Detalle operaciones*. La hoja *Resumen* incluye un bloque **Por marca**; *Cotizaciones* y *Detalle operaciones* tienen la columna **Marca**, además de los **parámetros usados por cada cotización** (columnas individuales y una columna de texto «Parámetros usados»), aunque cambien entre cotizaciones. También se puede descargar sin enviar.
- Alertas de confianza: confiabilidad baja, CV > 0,5, tiempos sin validar y suplemento histórico distinto.

## Qué NO incluye todavía

- Usuarios y roles (solo tiene autenticación básica opcional por variables de entorno).
- HTTPS: lo provee el proxy o el hosting (Render, Nginx, Caddy).
- Envío de EmailJS desde el servidor: el plan gratuito de EmailJS lo bloquea; hoy el envío se hace desde el navegador.
- Base de datos PostgreSQL: persiste en archivos JSON; en la nube se recomienda `DATA_DIR` sobre un disco persistente.
- Corrección de los botones VBA del Excel original (la web ya no depende de ellos).
- Carga de nuevas observaciones crudas al histórico (solo se importaron los datos existentes).

## Estructura

```
cotizador/
├─ data/                  # Se puede mover con DATA_DIR
│  ├─ catalog.json        # Datos extraídos del Excel
│  ├─ store.json          # Parámetros y cotizaciones guardadas (se crea solo)
│  ├─ store.anterior.json # Última versión válida (respaldo automático)
│  ├─ audit.log           # Bitácora de cambios (JSON Lines)
│  └─ exports/            # Excels generados del historial (con retención)
├─ public/                # Interfaz web
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  └─ fonts/               # Fuentes WOFF2 autoalojadas (sin Google Fonts)
├─ src/
│  ├─ engine.js           # Motor de cálculo puro (SAM / costo / precio)
│  └─ server.js           # API + servidor de archivos + Excel con ExcelJS
├─ tools/
│  └─ export_excel.ps1    # Solo Windows: convierte el .xlsm a catalog.json
├─ tests/
│  ├─ engine.test.js      # 9 pruebas del motor de cálculo
│  └─ api.test.js         # 50 pruebas de la API (levanta su propio servidor)
├─ render.yaml            # Blueprint de Render (disco, health check y secretos)
├─ .node-version          # Node 20 fijado para Render
├─ Dockerfile             # Imagen con usuario sin privilegios y healthcheck
├─ OPERACION.md           # Manual para el usuario final
├─ INICIAR.bat            # Solo Windows: arranque manual
├─ package.json
└─ README.md
```

## Pruebas

```bash
npm test
```

Corre el motor de cálculo y la suite de la API. La suite de API levanta su propio
servidor en un puerto libre con un `DATA_DIR` temporal, ejecuta 50 comprobaciones
(cálculo, parámetros, cotizaciones, Excel, correo, copias y seguridad) y borra
todo al terminar. No hace falta tener otro cotizador encendido ni modificar los
datos reales. Para correr una sola parte: `npm run test:engine` o `npm run test:api`.

## Volver a importar el Excel

Si se actualiza el archivo original:

```bat
powershell -ExecutionPolicy Bypass -File tools\export_excel.ps1
```

La importación desde la vista web usa el mismo script y abre el Excel con macros desactivadas (`AutomationSecurity = 3`), en modo solo lectura. Requiere **Windows + Microsoft Excel** en la máquina donde corre el servidor. En Linux/Render la ruta `/api/import` responde `501`; en ese caso se reemplaza `data/catalog.json` por el catálogo ya exportado.

Por defecto lee `C:\Users\group\Downloads\COTIZADOR DE MUESTRAS.xlsm`. Para otro origen:

```bat
powershell -ExecutionPolicy Bypass -File tools\export_excel.ps1 -Source "C:\ruta\otro.xlsm"
```

## Despliegue en Render / integración con otra aplicación

El repositorio incluye `render.yaml` con todo lo necesario. Pasos:

1. En Render: **New → Blueprint** y elegir este repositorio (debe estar en GitHub).
2. El plan **Free** ya está configurado en `render.yaml` (sin disco persistente). En Free, el sistema de archivos es efímero: las cotizaciones guardadas se conservan mientras la instancia esté activa, pero se pierden al reiniciar, redesplegar o suspenderse por inactividad. Para datos persistentes reales, use un plan de pago con disco o ejecute el cotizador en su PC con `INICIAR-WIFI.bat`.
3. Al crear el Blueprint, Render pide estos valores:
   - `PUBLIC_BASE_URL`: ya viene fijada en `render.yaml` como `https://cotizador-static.onrender.com`. Si el servicio se llamó distinto, cambie el valor por su URL real sin barra final: es la que usan los enlaces al Excel enviados por correo. Si falta, el servidor usa `RENDER_EXTERNAL_URL` (la URL pública que Render inyecta sola).
   - `ADMIN_TOKEN`: clave para toda operación que escriba (guardar cotizaciones, cambiar parámetros, importar, copias, restaurar y borrar). Guárdela en un gestor de contraseñas.
   - `CORS_ORIGIN`: vacío salvo que un frontend en otro dominio llame la API desde el navegador.

   El blueprint usa `NODE_ENV=development` y **no** configura autenticación básica, para que la página abra sin usuario/contraseña. Las acciones de escritura siguen protegidas por `ADMIN_TOKEN`. Si desea proteger todo el sitio con usuario/contraseña, cambie `NODE_ENV` a `production` y agregue `BASIC_AUTH_USER` y `BASIC_AUTH_PASS`.
4. Confirmar. El Blueprint ya configura: Node 20, `npm ci`, puerto de Render, `DATA_DIR=/opt/render/project/src/data`, `TRUST_PROXY=1` y health check en `/api/health`.
5. Verificar: abrir `https://<servicio>.onrender.com/api/health` y confirmar `ok: true`.

En Free no hay disco persistente. `DATA_DIR` apunta a `data/` dentro del proyecto (`/opt/render/project/src/data`), donde se guardan `catalog.json`, `store.json`, las copias en `backups/` y los Excel en `exports/`. Esos archivos son **efímeros**: se pierden al reiniciar/redesplegar/suspenderse la instancia. El catálogo vuelve a estar disponible porque va incluido en el repositorio.

Si usa un plan de pago con disco, configure `DATA_DIR=/var/data` y agregue el bloque `disk:` con `mountPath: /var/data`. **Un servicio con disco no puede tener varias instancias**: en cada deploy hay unos segundos de caída.

Si la otra aplicación llama la API desde el navegador en otro dominio, agregar `CORS_ORIGIN` con su URL en el panel de Render. Si la llama desde su backend, no hace falta.

El health check (`/api/health`) responde sin contraseña a propósito: Render no envía credenciales y, si no, daría el servicio por caído. Devuelve solo números y estado, nunca datos de cotizaciones.

Configuración equivalente si se crea el servicio a mano:

```text
Build command:  npm ci
Start command:  node src/server.js
Health Check Path:  /api/health
```

Variables de entorno:

| Variable | Obligatoria | Uso |
|---|---|---|
| `PORT` | La pone Render | Puerto del servidor. |
| `PUBLIC_BASE_URL` | Sí, en internet | URL pública sin barra final, por ejemplo `https://cotizador.onrender.com`. Se usa en el enlace al Excel del correo. Si falta, se toma `RENDER_EXTERNAL_URL` (la inyecta Render). |
| `DATA_DIR` | Recomendada | Carpeta de datos. En Render Free sin disco (por defecto en `render.yaml`): `/opt/render/project/src/data` (efímera). Con disco persistente: `/var/data`. Si está vacía, usa `./data`. Al arrancar por primera vez siembra `catalog.json` desde el proyecto. |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | Solo si `NODE_ENV=production` | Todo el sitio pide usuario y contraseña (HTTP Basic). Sin ambos valores, `NODE_ENV=production` aborta el arranque. En el blueprint de Render Free no se usan (la página abre sin login). |
| `LAN_IP` | Solo LAN | IP de la red local para los enlaces del correo cuando no hay `PUBLIC_BASE_URL`. |
| `CORS_ORIGIN` | Solo si hay frontend aparte | Orígenes autorizados a llamar la API desde el navegador, separados por coma (por ejemplo `https://app.empresa.com`). Vacío = sin CORS. `*` está prohibido en producción. |
| `EXPORT_MAX_FILES` | Opcional | Cantidad máxima de Excel que se conservan en `DATA_DIR/exports` (por defecto 60; se borran los más viejos). |
| `EXPORT_RETENTION_DAYS` | Opcional | Días que se conserva un Excel generado (por defecto 7; `0` desactiva el límite por edad). |
| `BACKUP_RETENTION` | Opcional | Cantidad de copias completas con fecha que se conservan en `DATA_DIR/backups` (por defecto 10). |
| `MIN_FREE_BYTES` | Opcional | Espacio libre mínimo antes de avisar que el disco está por llenarse (por defecto 200 MB). |
| `TRUST_PROXY` | Opcional | `1` si está detrás de un proxy de confianza (Render, Nginx). Usa `X-Forwarded-For` para identificar la IP en los límites de peticiones. |
| `ADMIN_TOKEN` | Obligatoria en producción | Clave exigida en **toda petición que no sea de lectura** (GET/HEAD y `/api/health` quedan fuera). Si se define, la interfaz la pide una vez por pestaña y la conserva solo en memoria. |
| `READ_ONLY` | Opcional | `1` deja el cotizador en solo lectura: se puede consultar y calcular, pero no guardar. |
| `AUDIT_USER_HEADER` | Opcional | Nombre del header que trae el usuario autenticado (solo con `TRUST_PROXY=1`). Se escribe en `audit.log`. |

### Docker

El `Dockerfile` usa Node 20 sobre Debian slim, instala solo dependencias de
producción, copia únicamente `src`, `public` y el catálogo semilla, y corre con
un usuario sin privilegios. Declara `VOLUME /app/data`, `STOPSIGNAL SIGTERM` y un
`HEALTHCHECK` que llama a `/api/health`.

```bash
docker build -t cotizador_muestras .
docker run -d --name cotizador -p 3100:3100 -v cotizador_data:/app/data cotizador_muestras
```

La imagen no se pudo construir en el PC donde se hicieron estos cambios (no hay
Docker instalado); la sintaxis del archivo está revisada pero la construcción
debe verificarse en el servidor donde se vaya a publicar.

Notas para la integración:

- **Persistencia:** sin `DATA_DIR` en un disco persistente, `store.json` y `catalog.json` se pierden en cada despliegue o reinicio de Render. En el plan free de Render el disco es efímero y el servicio se duerme por inactividad.
- **Autenticación:** el cotizador no maneja usuarios; si la otra aplicación ya autentica, se puede dejar sin `BASIC_AUTH_*` y protegerlo desde el proxy/aplicación que lo integra.
- **Enlaces del correo:** con `PUBLIC_BASE_URL` (o `RENDER_EXTERNAL_URL` en Render) el correo lleva la URL pública; sin ella intenta usar la IP LAN.
- **Excel:** se genera con `exceljs` en memoria del servidor; no requiere Excel ni PowerShell.
- **Importar Excel:** solo Windows. Para actualizar datos en la nube, reemplazar `catalog.json` en `DATA_DIR`.

### API HTTP

Toda la API responde JSON y no requiere sesión salvo que se definan `BASIC_AUTH_*`.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/health` | Estado real del servicio: versión, permisos de escritura, catálogo, cotizaciones y tiempo encendido. Devuelve `503` si algo no está bien. |
| `GET` | `/api/bootstrap` | Catálogo, parámetros y cotizaciones guardadas. |
| `GET` / `PUT` | `/api/parameters` | Leer y guardar los parámetros de cotización. |
| `POST` | `/api/calculate` | Calcular una cotización sin guardarla. |
| `GET` / `POST` | `/api/quotes` | Listar y guardar cotizaciones. |
| `GET` / `DELETE` | `/api/quotes/:id` | Obtener o eliminar una cotización. |
| `GET` | `/api/references` | Listar referencias (incluye `marca`). |
| `PUT` | `/api/references/:code` | Actualizar la marca de una referencia: `{ "marca": "Crearte" }`. |
| `GET` / `POST` | `/api/email/summary` | Resumen de las cotizaciones indicadas en `{ "ids": [...] }`. |
| `POST` | `/api/email/excel` | Genera el Excel de esas cotizaciones y devuelve `downloadUrl`. |
| `GET` | `/api/email/download?file=...` | Página intermedia de descarga del Excel. |
| `GET` | `/api/email/download/file?file=...` | Descarga directa del `.xlsx`. |
| `GET` | `/api/backup/status` | Copias existentes, espacio libre y resultado del ensayo de restauración. |
| `GET` | `/api/backup/download` | Descarga un JSON con catálogo, parámetros y cotizaciones. |
| `POST` | `/api/backup/create` | Crea una copia con fecha (requiere `X-Admin-Token` si está configurado). |
| `POST` | `/api/backup/verify` | Valida una copia sin aplicarla: `{ ...contenido del JSON... }`. |
| `POST` | `/api/backup/restore` | Reemplaza todos los datos con la copia enviada (requiere `X-Admin-Token`). |
| `POST` | `/api/email/emailjs/preview` | Arma el HTML del correo para las cotizaciones indicadas. |
| `POST` | `/api/import` | Importar `.xlsm` (solo Windows + Excel instalado). |

Ejemplo para guardar una marca:

```bat
curl -X PUT http://localhost:3100/api/references/A0065 -H "Content-Type: application/json" -d "{\"marca\":\"Crearte\"}"
```

Si la otra aplicación llama la API **desde el navegador** (otro dominio), definir `CORS_ORIGIN` con su URL. Si la llama desde su servidor (backend a backend), no hace falta.

### Seguridad aplicada

Todas las respuestas llevan estas cabeceras:

| Cabecera | Valor | Para qué |
|---|---|---|
| `Content-Security-Policy` | Solo el propio origen y `api.emailjs.com` | Evita inyectar scripts externos. Las fuentes están en `/fonts`, sin Google Fonts. |
| `X-Frame-Options` | `DENY` | Impide incrustar el cotizador en un iframe ajeno (clickjacking). |
| `Referrer-Policy` | `no-referrer` | No filtra la URL interna al navegar fuera. |
| `Permissions-Policy` | Sin cámara, micrófono, ubicación ni pagos | Reduce superficie de ataque. |
| `X-Content-Type-Options` | `nosniff` | Evita que el navegador adivine tipos. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Bloquea que otros sitios lean los archivos. |
| `Strict-Transport-Security` | Solo si `PUBLIC_BASE_URL` es `https://` | Fuerza HTTPS cuando se publica con TLS. |

Protección **CSRF** en todo cambio de datos (`POST`, `PUT`, `DELETE`):

- Se valida `Origin`/`Referer` contra el propio servidor (o contra `CORS_ORIGIN` si se integra desde otro dominio).
- Los métodos con cuerpo exigen `Content-Type: application/json` (o `application/octet-stream` en `/api/import`). Un formulario HTML malicioso no puede enviar ese tipo sin pasar por CORS.

Consecuencias para la integración:

- Las llamadas **desde el servidor** de la otra aplicación funcionan sin cambios (no envían `Origin`).
- Las llamadas **desde el navegador de otro dominio** requieren `CORS_ORIGIN` con ese dominio exacto.
- Al crear/actualizar hay que enviar `Content-Type: application/json`; si no, responde `415`.
- `DELETE` no exige cuerpo ni tipo de contenido.

### Protección de datos y límites

| Mecanismo | Qué hace |
|---|---|
| **Respaldo de `store.json`** | Antes de cada guardado, la versión anterior se copia a `store.anterior.json`. El botón **Restaurar copia anterior** la usa. |
| **Recuperación automática** | Si `store.json` está dañado, se aparta como `store.corrupt-<fecha>.json` (nunca se borra) y se recupera `store.anterior.json`. Si tampoco sirve, arranca sin historial y muestra el aviso en la interfaz. |
| **Escritura atómica** | Los JSON se escriben en un temporal, se sincronizan a disco y se renombran: un corte de luz no deja un archivo a medias. |
| **Campos acotados** | Referencia 60, descripción 240, tipo 80, marca 80, operación 160 caracteres; máximo 80 operaciones por cotización y 20.000 cotizaciones guardadas. |
| **Cálculo en el servidor** | Al guardar una cotización se recalcula siempre; se ignora cualquier resultado enviado por el cliente. |
| **Límite de peticiones** | 12 generaciones de Excel o vistas previas cada 5 minutos por IP; 5 importaciones o restauraciones cada 10 minutos; solo una importación a la vez (si hay otra en curso, responde `409`). |
| **Bloqueo de login** | Con `BASIC_AUTH_*` activo, tras 20 intentos fallidos desde una IP se responde `429` durante 15 minutos. |
| **Bitácora** | `DATA_DIR/audit.log` (JSON Lines) registra fecha, IP, usuario (cuando lo aporta el proxy con `TRUST_PROXY=1` + `AUDIT_USER_HEADER`) y acción: crear/eliminar cotización, cambiar parámetros, cambiar marca, importar, limpiar y restaurar. Rota a `audit.log.1` al pasar de 2 MB. |
| **Errores genéricos** | Los fallos internos responden `Error interno del servidor`; las rutas del sistema quedan solo en el log del servidor. |
| **Retención de Excel** | Se borran los Excel de más de 7 días y se conservan como máximo 60 (configurable). |

### Clave de administrador y modo solo lectura

Con `ADMIN_TOKEN` definido, **todas las peticiones que escriben** (guardar cotizaciones y parámetros, marcas, importar, copias, restaurar, borrar y generar Excel) exigen el header `X-Admin-Token`. Solo `GET`, `HEAD`, `OPTIONS` y `/api/health` quedan fuera. La interfaz lo pide una vez por pestaña y lo conserva **solo en memoria** (nunca en `sessionStorage`/`localStorage`, donde un XSS podría leerlo). Desde el backend de otra aplicación hay que enviarlo en esas llamadas.

Con `READ_ONLY=1`, la aplicación permite consultar, calcular y generar Excel, pero rechaza con HTTP `503` cualquier escritura, incluidas crear/restaurar copias. Es útil durante copias o revisiones.

En `NODE_ENV=production` el arranque se detiene (`process.exit(1)`) si falta `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` o `ADMIN_TOKEN`, o si `CORS_ORIGIN=*`. No existe modo "abierto" en producción: si otra aplicación autentica, debe hacerlo en un proxy delante del cotizador.

La importación acepta únicamente `.xlsx` sin macros: se validan la firma ZIP, las entradas `[Content_Types].xml` y `xl/workbook.xml`, y se rechaza `xl/vbaProject.bin`. El script `tools/export_excel.ps1` abre el libro con `$excel.AutomationSecurity = 3` (macros desactivadas).

### Diagnóstico, versión y apagado

- **Versión visible**: el número de `package.json` aparece al pie de la pantalla y en `/api/health` y `/api/bootstrap`. Así se puede confirmar de un vistazo si dos equipos tienen la misma versión.
- **Health check real**: `GET /api/health` comprueba que se pueda escribir en `DATA_DIR`, que el catálogo y `store.json` sean legibles, y devuelve `503` con un array `problems` si falla algo. Si hubo una recuperación automática, el campo `degraded` avisa sin apagar el servicio.
- **Logs de arranque**: al iniciar se imprimen versión, URLs, ruta de datos, autenticación, modo, catálogo, límites y avisos. Con eso se descarta de entrada una mala configuración.
- **Apagado ordenado**: al recibir `Ctrl + C` o `SIGTERM` el servidor deja de aceptar peticiones nuevas, espera a que terminen las que había en curso (máximo 10 segundos) y cierra. Los datos ya están guardados en disco porque cada cambio se escribe de inmediato.

### Copias de seguridad

En la pestaña **Importar** hay un bloque **Copias de seguridad**:

- **Descargar copia actual**: baja un `.json` con catálogo, parámetros y cotizaciones. Guárdelo en otro equipo, pendrive o Drive; no depende de este servidor.
- **Crear copia ahora**: guarda una copia con fecha en `DATA_DIR/backups`. Se conservan las últimas 10 (configurable con `BACKUP_RETENTION`). También se crean copias automáticas antes de importar, limpiar o restaurar, y una primera copia al arrancar si no había ninguna.
- **Probar esta copia**: lee el archivo elegido y comprueba que tenga la estructura correcta, indicando cuántas operaciones, referencias y cotizaciones contiene. **No modifica nada**: es el ensayo de restauración.
- **Restaurar desde esta copia**: reemplaza todos los datos con el archivo elegido. Pide confirmación escribiendo `RESTAURAR` y guarda una copia de los datos anteriores antes de aplicar el cambio.

El estado de las copias, el espacio libre en disco y el ensayo automático se pueden consultar en `GET /api/backup/status`. Si queda menos espacio del indicado en `MIN_FREE_BYTES`, `/api/health` pasa a `503` y se avisa en el arranque y en la interfaz.

Pendiente recomendado (no implementado aún): HTTPS fuera de la LAN y mover el envío de EmailJS al servidor (el plan gratuito de EmailJS bloquea el envío desde Node, así que requiere plan pago o seguir enviando desde el navegador).

## Enviar cotizaciones seleccionadas sin contraseña (EmailJS)

1. En la pestaña **Historial**, marcar con el casillero las cotizaciones que se deben enviar. Se puede usar **Seleccionar todas** / **No seleccionar ninguna** en la pestaña **Correo**.
2. Ir a la pestaña **Correo**.
3. Escribir el correo de destino (y, si quieres, cambiar el asunto).
4. Opcional: **Vista previa del correo** para revisar el resumen y el enlace antes de enviar.
5. Clic en **Enviar resumen por EmailJS**.

Solo se incluyen en el correo y en el Excel las cotizaciones seleccionadas; las demás se omiten. El correo llega con el resumen, el desglose por marca y una tabla única de cotizaciones (referencia, descripción, tipo, marca, operaciones, SAM, costo y precio, con subtotales y total). El botón **Abrir descarga del Excel** lleva a una página donde se pulsa **Descargar Excel**: el archivo se genera en el navegador, así que Chrome no lo bloquea y no hay que instalar certificados ni configurar nada. El enlace usa `PUBLIC_BASE_URL` cuando está definida (internet) o la IP de la red local en caso contrario; el archivo también queda en `DATA_DIR/exports/`. Se usa una cuenta propia de EmailJS, que no requiere contraseña de correo.

También hay un acceso directo **“Enviar seleccionadas por correo”** en la vista *Historial*, que lleva a la pestaña *Correo*.

> **Importante — asunto del correo:** el cotizador usa su **propia cuenta de EmailJS** (`service_8lq3ei3`, `template_ersho2m`, Public Key `d1WCtmrksSpYe5uKe`, configurados en `public/app.js`), así que no comparte el campo Subject con la plantilla que otro proceso usa para «Inspección de telas», que queda intacta en la cuenta anterior. La plantilla del cotizador debe tener:
>
> ```text
> Subject:   {{subject}}
> To Email:  {{to_email}}
> From Name: {{from_name}}
> Reply To:  {{reply_to}}
> Content:   {{{report_html}}}
> ```
>
> El Content lleva triple llave para que el HTML no se escape y debe contener **solo** esa variable, sin texto alrededor. La plantilla anterior (`template_m1m82jn`) la sigue usando el otro software con su Subject original `Inspeccion de telas:{{title}}` y **no se debe modificar**. El parámetro `cotizador_subject` se sigue enviando por compatibilidad, pero la plantilla nueva toma el asunto de `subject`.

## Pruebas

```bat
node --test tests\engine.test.js
```

## Notas de negocio

- El **tiempo ajustado** manual tiene prioridad sobre el tiempo base del catálogo.
- Jerarquía del tiempo base: validado → base histórica → mediana → P75.
- Fórmula: `SAM = (tiempo base × cantidad / 60) × (1 + suplemento) × complejidad`.
- Costo: `SAM × tarifa del bloque`. Precio sugerido: `costo / (1 - utilidad)`.
- Los parámetros se versionan en cada cotización guardada, para que una cotización antigua no cambie si se modifica la configuración.
