# Guía técnica del código

Esta guía explica la responsabilidad de los archivos escritos para la aplicación y el propósito de sus bloques funcionales. No se añadieron comentarios dentro del código: así se conserva el comportamiento y se evita llenar los archivos fuente con explicaciones repetidas. Las llaves, paréntesis, etiquetas JSX y espacios organizan la sintaxis; las secciones de abajo explican qué hace cada parte funcional.

El diagrama visual está en [diagrama-flujo-inspeccion.svg](./diagrama-flujo-inspeccion.svg).

## 1. Qué hace la aplicación

Es una aplicación web React para registrar inspecciones de rollos de tela. Captura los datos generales de la inspección y las medidas/defectos de cada rollo, calcula puntuaciones y decisiones, presenta resúmenes y gráficas, guarda inspecciones en el almacenamiento local del navegador y permite preparar reportes por correo o PDF.

### Recorrido principal de los datos

1. `index.html` proporciona el elemento raíz de la página y carga `src/main.jsx`.
2. `main.jsx` monta React, crea el componente principal `App` y carga los estilos globales.
3. `App.jsx` conserva los datos y coordina los componentes, cálculos, almacenamiento y acciones.
4. `InspectionForm.jsx` cambia los datos generales; `RollTable.jsx` cambia la captura de rollos.
5. `calculations.js` calcula puntos por rollo y el resultado del lote. Los rollos editados son un borrador: el botón **Guardar rollos** los confirma para el resumen.
6. **Guardar inspección** valida y persiste el registro en `localStorage` a través de `services/inspections.js`.
7. El usuario puede consultar/editar/eliminar registros, preparar el correo con EmailJS o descargar el reporte PDF.

## 2. Archivos de entrada y configuración

### `index.html`

- Declara un documento HTML en español y configura la codificación de caracteres, el viewport adaptable a móviles, el color del navegador y la descripción.
- Define el título de la pestaña.
- `<div id="root">` es el punto donde React dibuja toda la aplicación.
- El `<script type="module">` carga el punto de entrada `src/main.jsx`.

### `src/main.jsx`

- Importa las funciones de montaje de React y el componente `App`.
- Importa `global.css`, que aplica estilos base a toda la interfaz.
- Busca `#root` y monta dentro de él la aplicación.
- `React.StrictMode` activa comprobaciones de desarrollo de React; no constituye una función de negocio ni guarda datos.

### `package.json`

- Declara el nombre/versión del proyecto y que usa módulos JavaScript.
- `dev` inicia Vite en modo desarrollo; `build` prepara los archivos optimizados; `preview` sirve la compilación localmente.
- Las dependencias principales son React para la interfaz, Recharts para gráficas, Lucide para iconos, jsPDF para PDF y EmailJS para correo.
- Las dependencias de desarrollo son Vite y su complemento React.

### `vite.config.js`

- Configura Vite y activa el complemento de React para procesar JSX.
- `server.host: "0.0.0.0"` hace que el servidor de desarrollo escuche en las interfaces de red disponibles.

### `firebase.json`

- Configura el directorio `functions` y el runtime Node.js 20 para funciones de Firebase.
- Configura Hosting para publicar el contenido compilado de `dist`.
- Excluye del hosting la configuración, archivos ocultos y `node_modules`.
- La regla de reescritura entrega `index.html` para rutas de la aplicación cliente.

### `.env.example` y `.env.local`

- `.env.example` muestra los nombres requeridos para EmailJS: Service ID, Template ID y Public Key.
- `.env.local` contiene la configuración local usada por Vite. No se documentan aquí sus valores; no se deben publicar credenciales ni datos de configuración privados.

## 3. Componente principal: `src/App.jsx`

`App` coordina la aplicación. La importación inicial reúne hooks de React, iconos, gráficas, componentes de interfaz, cálculos, servicios y hojas de estilo.

### Datos iniciales y preparación

- `blankRolls()` construye 30 rollos vacíos, numerados desde 1, con medidas y cantidades de defectos en cero, color blanco y observaciones vacías.
- `getVisibleRollCount(rolls)` busca el último rollo con datos y calcula cuántas filas mostrar; comienza mostrando al menos una y deja preparada la siguiente fila.
- `restoreRolls(record)` prepara rollos guardados con valores predeterminados para campos ausentes. La edición actual también reconstruye los rollos dentro de `handleEditInspection`.
- `localDate()` produce la fecha local en formato `AAAA-MM-DD`, sin desplazarla por la zona horaria.
- `initialInfo()` define la fecha, los campos generales vacíos y los límites iniciales: 40 puntos para rollo y 28 para lote.

### Estado de la pantalla

Los `useState` guardan:

- La lista de inspecciones existentes y el formulario actual (`info`).
- Los rollos del borrador y la copia confirmada para los cálculos del resumen (`rolls` y `savedRolls`).
- Observaciones, estado de envío y mensajes de correo.
- Si el registro fue guardado, si los rollos tienen cambios pendientes y el error asociado.
- La apertura de cada ventana (rollos, correo, base de datos y ayuda), el identificador de edición y el número de filas visibles.
- Errores de validación/guardado.

La lista inicial se lee de `loadInspections`; los campos del formulario y la tabla nueva comienzan con valores iniciales. La aplicación no restaura automáticamente el último registro en el formulario al abrirse.

### Efecto para ventanas

`useEffect` escucha la tecla Escape cuando hay un diálogo abierto, bloquea el desplazamiento del fondo mientras se muestra y, al cerrar o desmontar el diálogo, quita el listener y restaura el desplazamiento anterior.

### Cálculos derivados y reportes

- `calculated` calcula los rollos que se están editando; `draftLot` resume ese borrador para la tabla.
- `savedCalculated` y `lot` representan la copia confirmada de rollos, que alimenta las tarjetas, gráficas y reportes.
- `useMemo` vuelve a calcular estos valores solo cuando cambian sus datos de entrada.
- `chartData` agrupa los puntos por 100 yd² en cinco intervalos; el último identifica los rollos por encima del límite individual.
- `reportText` prepara un reporte de texto con datos de inspección, resumen, detalle de rollos y observaciones.
- `reportHtml` prepara el detalle tabular HTML para correo. `escapeHtml` convierte caracteres especiales para que datos ingresados por el usuario se muestren como texto, no como etiquetas HTML.
- `hasInspectionData`, `notifications` y `decisionData` generan respectivamente el indicador de datos, los avisos y los valores/colores de la gráfica de aceptados y rechazados.

### Manejadores de acciones

- `updateInfo(key, value)` actualiza un dato general y marca la inspección como modificada.
- `updateRoll(id, key, value)` actualiza un campo del rollo, marca cambios pendientes y limpia los mensajes antiguos de error.
- `handleSaveRolls()` impide confirmar si ningún rollo tiene medidas completas; si hay rollos válidos, copia el borrador a `savedRolls` y cierra su ventana.
- `handleResetRolls()` reinicia a cero los 30 rollos y limpia los estados de captura.
- `handleSave()` valida los datos generales, exige confirmar los cambios de rollos y requiere al menos un rollo completo. Crea el registro y usa el servicio de almacenamiento; si ocurre un error, lo muestra en pantalla.
- `handleNewInspection()` reinicia los campos y estados para empezar otro registro.
- `handleEditInspection(record)` restaura los datos de una inspección guardada y abre la pantalla en modo edición.
- `handleDeleteInspection(id)` delega el borrado en el servicio y limpia el estado de edición si se eliminó el registro que se estaba editando.
- `handleEmail(form)` comprueba destinatario, correo válido, cambios pendientes y existencia de rollos; luego llama al servicio EmailJS y muestra éxito o error.
- `handleDownloadPdf()` requiere una inspección guardada y sin cambios pendientes de rollos; genera el reporte de texto como PDF y maneja errores.

### Interfaz renderizada

- `Header` muestra identidad, ayuda, notificaciones y accesos rápidos.
- Los accesos principales abren el registro de rollos y la base de datos.
- `InspectionForm` presenta los datos generales; `SummaryCards` presenta los indicadores del lote.
- La primera gráfica es el histograma de puntuaciones. La segunda es un anillo de aceptados/rechazados. Ambas usan Recharts.
- El panel de cierre muestra la decisión del lote y botones para guardar/actualizar, comenzar una nueva inspección, abrir el envío de correo, imprimir o descargar PDF.
- Los mensajes de validación, error y éxito aparecen junto a sus acciones.
- Los diálogos condicionales presentan el registro de rollos, el editor de correo, la base de datos y la ayuda. Cerrar al hacer clic en el fondo o con Escape depende de los manejadores del componente.
- Los atributos `role`, `aria-*` y las etiquetas dan nombre/estado a botones y diálogos para tecnologías de asistencia.

## 4. Componentes de `src/components/`

### `Header.jsx`

- Recibe funciones para abrir ayuda, registro y base de datos, además de la lista de avisos.
- Muestra el logo de `public/crearte-logo.png`, marca y nombre de la pantalla.
- Mantiene localmente abierto/cerrado el menú de notificaciones.
- Renderiza cada aviso y, si tiene acción, llama al acceso apropiado antes de cerrar el menú.
- Presenta los criterios de calificación que acompañan a la interfaz.

### `InspectionForm.jsx`

- El componente interno `Field` reutiliza el marcado de una etiqueta y un campo de entrada, su icono, valor y manejador.
- `InspectionForm` organiza fecha, proveedor, tela y remisión en una cuadrícula.
- Al editar, cambia la etiqueta de estado de **NUEVA** a **EDITANDO**.
- Cada cambio llama a `updateInfo` recibido desde `App`; el formulario no guarda directamente.

### `RollTable.jsx`

- `numericFields` describe los seis campos numéricos de cada fila: largo, ancho y cuatro niveles de defectos.
- Renderiza solo la cantidad de rollos visible recibida por propiedades.
- Permite cambiar número, color, medidas, defectos y observaciones usando `updateRoll`.
- Al enfocar una cifra la selecciona; al dejar vacío un campo numérico, vuelve a cero.
- Muestra los puntos calculados y una etiqueta de decisión; los cálculos se reciben desde `App`.

### `SummaryCards.jsx`

- Convierte los datos del lote en cuatro tarjetas: cantidad inspeccionada, aceptada, rechazada y promedio.
- Elige icono y tono visual para cada indicador.
- No realiza persistencia ni cálculo de calidad; presenta el objeto `lot` que recibe.

### `InspectionDatabase.jsx`

- Recibe inspecciones y callbacks de editar, eliminar y cerrar.
- Mantiene una selección local para alternar entre la lista y el detalle del registro.
- `getInspectedCount` admite el formato de cantidad o arreglo de rollos inspeccionados.
- `handleDelete` pide confirmación del navegador antes de llamar a `onDelete`.
- La lista permite ver, editar y eliminar. El detalle presenta datos generales, cifras y tabla de rollos.
- Si se hace clic en el fondo del diálogo, no en su contenido, se cierra.

### `EmailComposer.jsx`

- Recibe los datos y callbacks de envío desde `App`; mantiene localmente el nombre y adjuntos seleccionados.
- Arma un saludo y un cuerpo de correo. Escapa el saludo y las observaciones para proteger el HTML, y agrega el reporte HTML recibido.
- Los campos ocultos `subject` y `report_html` son variables de la plantilla EmailJS.
- Valida por tipo/extensión que el adjunto sea PDF o imagen; el tamaño combinado se comprueba en el servicio de correo.
- Permite adjuntar o cambiar PDF e imagen, muestra los archivos seleccionados y ofrece una acción explícita para quitar la imagen; desactiva acciones mientras se envía.
- Al recibir un mensaje de éxito nuevo, limpia las selecciones de archivo.

## 5. Servicios de `src/services/`

### `inspections.js`

- `STORAGE_KEY` identifica la clave de esta aplicación en `localStorage`.
- `loadInspections()` devuelve la lista JSON guardada o una lista vacía si no existe.
- `saveInspection(record)` reemplaza un registro con el mismo identificador, lo coloca al inicio y limita el historial a 100 registros.
- `deleteInspection(id)` filtra el registro solicitado, guarda la lista restante y la devuelve.
- El almacenamiento es local a ese navegador/dispositivo; este código no sincroniza con un servidor o base de datos remota.

### `email.js`

- Lee las variables EmailJS `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID` y `VITE_EMAILJS_PUBLIC_KEY` desde la configuración de Vite.
- `getFormValue` lee y recorta un campo del formulario.
- `getFileInput` comprueba si el campo solicitado es una entrada de archivo.
- `getSelectedFiles` encuentra los campos de adjunto y comprueba formato/extensión y límite combinado de 6 MB.
- `sendInspectionEmail({ form })` requiere configuración, comprueba el destinatario, valida adjuntos y llama a `emailjs.sendForm`.
- Si EmailJS devuelve un error, lanza un mensaje explícito para que `App` lo muestre.
- **El camino de correo conectado actualmente en el frontend es EmailJS**, no Firebase Functions.

### `inspectionExport.js`

- `createFilename(name)` elimina acentos y caracteres no seguros, normaliza el nombre y añade `.pdf`.
- `createInspectionPdfFile(reportText, filename)` crea un documento A4, divide líneas largas, destaca títulos y secciones y añade páginas cuando se agota el espacio.
- `downloadInspectionPdf(...)` crea una URL temporal del archivo, simula un clic de descarga y luego revoca la URL temporal.

## 6. Lógica de `src/utils/`

### `calculations.js`

- `calculateRoll(roll, limit)` convierte medidas a número y trata cantidades vacías de defectos como cero.
- Pondera los defectos: `D1 + 2×D2 + 3×D3 + 4×D4`.
- Requiere largo y ancho mayores que cero para calcular puntos por área. Sin medidas devuelve `pointsPer100: null` y decisión **Pendiente**.
- Convierte largo de metros a yardas y ancho de centímetros a pulgadas; aplica la fórmula equivalente a `totalPoints × 3600 / (largo en yd × ancho en in)`.
- Compara el resultado con el límite individual y devuelve **Aceptado** o **Rechazado / segunda**.
- `calculateLot(rolls, limit)` descarta rollos incompletos, cuenta aceptados/rechazados y calcula el promedio ponderado por área.
- Calcula la proporción de rollos rechazados. El lote se acepta si el promedio está dentro del límite y la proporción rechazada es como máximo 15%; sin rollos completos queda **Pendiente**.

### `validations.js`

- `validateInspection(info)` devuelve una lista de mensajes, no guarda ni modifica datos.
- Exige fecha, proveedor, tela y remisión.
- El correo es opcional para guardar; si se proporciona, valida su formato.
- `App` añade otras reglas del flujo, como exigir rollos completos y confirmar los cambios del registro antes de guardar.

## 7. Estilos y recursos

### `src/styles/global.css`

- Importa las familias de fuente DM Sans y Manrope.
- Define color/fuente base, restablece el modelo de caja, quita el margen por defecto del `body` y comparte la tipografía con botones y campos.

### `src/styles/dashboard.css`

- Define el diseño visual de la aplicación: encabezado, marca, avisos, contenido y tarjetas de acceso.
- Da estilo a los diálogos de rollos/base de datos/correo y a sus estados de interacción.
- Incluye la apariencia común de paneles, botones, indicadores, gráficas, resumen, mensajes y ayuda.
- Las consultas `@media` reorganizan o reducen la interfaz en pantallas pequeñas; `@media print` adapta la página para imprimir.
- Las reglas responden a nombres `className` de los componentes React; no contienen las reglas de cálculo de calidad.

### `src/styles/inspection.css`

- Da forma al formulario general, etiquetas y campos.
- Estiliza la tabla de rollos, encabezados, entradas, valores calculados y decisiones.
- La consulta móvil ajusta espaciado y altura de la tabla para pantallas estrechas.

### `public/crearte-logo.png`

- Imagen de marca cargada por `Header.jsx`; los archivos de `public` se sirven como recursos estáticos.

## 8. Función de Firebase heredada

### `functions/index.js`

Este archivo contiene una función callable `sendInspectionEmail` basada en Firebase Functions, Firebase Admin, Firestore y Nodemailer. Está en el repositorio, pero **la interfaz actual no la invoca**: `src/services/email.js` usa EmailJS directamente.

- Inicializa Firebase Admin y declara secretos SMTP.
- `normalizeText` verifica tipo y límite de longitud de los campos.
- `decodeAttachments` valida cantidad, tipos, extensión, encabezado PDF y tamaño total de los adjuntos.
- `applyRateLimit` usa una transacción de Firestore para limitar envíos diarios por IP.
- La función exige App Check, valida destinatario/asunto/mensaje, aplica el límite, crea un transporte Gmail y trata de enviar.
- Los errores de configuración o SMTP se registran y devuelven errores callable explícitos.

### `functions/package.json`

- Declara `index.js` como entrada de la función, Node.js 20 y sus dependencias de Firebase y Nodemailer.

> Tener esta función en el repositorio no significa que esté desplegada ni que se use. El envío del navegador se configura según la sección EmailJS del README.

## 9. Archivos auxiliares y límites de esta guía

- `README.md` contiene instrucciones de instalación, funciones disponibles y configuración de EmailJS.
- `package-lock.json` y `functions/package-lock.json` son archivos generados por npm que fijan versiones transitivas; no contienen lógica de negocio que deba explicarse línea por línea.
- `dist/` es la compilación de salida y `node_modules/` contiene dependencias instaladas: no son código fuente mantenido a mano.
- `.gitignore` define qué archivos/carpetas no se deben versionar; `.firebaserc` relaciona Firebase CLI con la configuración del proyecto.
- Los valores locales de `.env.local` y los secretos de Firebase no se reproducen en la documentación.

La guía cubre los archivos de aplicación y configuración que mantienen el comportamiento. Describe líneas de código agrupadas por función: no repite literalmente cada llave, etiqueta o regla visual, porque esas líneas estructurales se entienden por el bloque al que pertenecen.

## 10. Índice de líneas esenciales del código

Cada enlace abre el archivo en la línea indicada. El fragmento reproduce una línea exacta del código y la explicación dice qué buscar en su bloque. Los números corresponden a la versión actual del proyecto; si el código cambia, el número puede moverse.

### Inicio y coordinación

| Archivo y línea | Fragmento exacto | Qué hace esa línea o su bloque |
|---|---|---|
| [`index.html`, línea 13](../index.html#L13) | `<div id="root"></div>` | Define dónde React inserta la pantalla. |
| [`index.html`, línea 14](../index.html#L14) | `<script type="module" src="/src/main.jsx"></script>` | Conecta el HTML con el arranque de la aplicación. |
| [`src/main.jsx`, línea 6](../src/main.jsx#L6) | `ReactDOM.createRoot(document.getElementById("root")).render(` | Monta React dentro del elemento raíz. |
| [`src/main.jsx`, línea 7](../src/main.jsx#L7) | `<React.StrictMode>` | Activa las comprobaciones adicionales de React durante desarrollo. |
| [`src/App.jsx`, línea 57](../src/App.jsx#L57) | `const blankRolls = () =>` | Inicia la creación de la tabla inicial de 30 rollos. |
| [`src/App.jsx`, línea 117](../src/App.jsx#L117) | `export default function App() {` | Define el componente principal que coordina la aplicación. |
| [`src/App.jsx`, línea 118](../src/App.jsx#L118) | `const [inspections, setInspections] = useState(loadInspections);` | Carga el historial local como estado inicial. |
| [`src/App.jsx`, línea 120](../src/App.jsx#L120) | `const [rolls, setRolls] = useState(blankRolls);` | Conserva los rollos que el usuario está capturando. |
| [`src/App.jsx`, línea 160](../src/App.jsx#L160) | `const calculated = useMemo(` | Inicia el cálculo de las filas que están en edición. |
| [`src/App.jsx`, línea 184](../src/App.jsx#L184) | `const draftLot = useMemo(` | Inicia el resumen provisional del borrador de rollos. |
| [`src/App.jsx`, línea 193](../src/App.jsx#L193) | `const lot = useMemo(` | Inicia el cálculo del lote confirmado que ve el resumen. |
| [`src/App.jsx`, línea 203](../src/App.jsx#L203) | `const chartData = useMemo(() => {` | Agrupa resultados para alimentar la gráfica de barras. |

### Captura, validación y almacenamiento

| Archivo y línea | Fragmento exacto | Qué hace esa línea o su bloque |
|---|---|---|
| [`src/components/InspectionForm.jsx`, línea 9](../src/components/InspectionForm.jsx#L9) | `const Field = ({` | Crea el campo reutilizable del formulario general. |
| [`src/components/InspectionForm.jsx`, línea 34](../src/components/InspectionForm.jsx#L34) | `export default function InspectionForm({` | Presenta los datos de fecha, proveedor, tela y remisión. |
| [`src/components/RollTable.jsx`, línea 3](../src/components/RollTable.jsx#L3) | `const numericFields = [` | Enumera las columnas de largo, ancho y defectos. |
| [`src/components/RollTable.jsx`, línea 12](../src/components/RollTable.jsx#L12) | `export default function RollTable({` | Inicia la tabla editable de rollos. |
| [`src/App.jsx`, línea 406](../src/App.jsx#L406) | `const updateRoll = (id, key, value) => {` | Actualiza un campo de un rollo y marca cambios pendientes. |
| [`src/App.jsx`, línea 421](../src/App.jsx#L421) | `const handleSaveRolls = () => {` | Confirma el borrador de rollos para el resumen. |
| [`src/utils/validations.js`, línea 1](../src/utils/validations.js#L1) | `export function validateInspection(info) {` | Comprueba los campos generales obligatorios. |
| [`src/App.jsx`, línea 444](../src/App.jsx#L444) | `const handleSave = () => {` | Inicia la validación y el guardado de la inspección completa. |
| [`src/App.jsx`, línea 469](../src/App.jsx#L469) | `saveInspection(record);` | Envía el registro validado al servicio local. |
| [`src/services/inspections.js`, línea 1](../src/services/inspections.js#L1) | `const STORAGE_KEY = "crearte_inspeccion_telas_v1";` | Nombre de la clave usada en `localStorage`. |
| [`src/services/inspections.js`, línea 3](../src/services/inspections.js#L3) | `export function loadInspections() {` | Lee el historial guardado en el navegador. |
| [`src/services/inspections.js`, línea 8](../src/services/inspections.js#L8) | `export function saveInspection(record) {` | Inserta o reemplaza un registro y limita el historial a 100. |
| [`src/services/inspections.js`, línea 23](../src/services/inspections.js#L23) | `export function deleteInspection(id) {` | Quita del almacenamiento el registro indicado. |
| [`src/components/InspectionDatabase.jsx`, línea 25](../src/components/InspectionDatabase.jsx#L25) | `if (window.confirm(` | Pide confirmación antes de borrar una inspección. |

### Cálculos, reporte y envío

| Archivo y línea | Fragmento exacto | Qué hace esa línea o su bloque |
|---|---|---|
| [`src/utils/calculations.js`, línea 1](../src/utils/calculations.js#L1) | `export function calculateRoll(roll, limit = 40) {` | Calcula puntos y decisión de un rollo. |
| [`src/utils/calculations.js`, línea 21](../src/utils/calculations.js#L21) | `const totalPoints =` | Inicia la suma ponderada D1–D4. |
| [`src/utils/calculations.js`, línea 35](../src/utils/calculations.js#L35) | `const pointsPer100 =` | Inicia la fórmula de puntos por 100 yd². |
| [`src/utils/calculations.js`, línea 53](../src/utils/calculations.js#L53) | `export function calculateLot(rolls, limit = 28) {` | Calcula promedio, proporción rechazada y decisión del lote. |
| [`src/utils/calculations.js`, línea 90](../src/utils/calculations.js#L90) | `const decision = !inspected.length` | Determina si el lote queda pendiente, aceptado o rechazado. |
| [`src/App.jsx`, línea 230](../src/App.jsx#L230) | `const reportText = useMemo(() => {` | Prepara el reporte de texto usado para PDF e impresión. |
| [`src/App.jsx`, línea 266](../src/App.jsx#L266) | `const reportHtml = useMemo(() => {` | Prepara el detalle HTML que se inserta en el correo. |
| [`src/components/EmailComposer.jsx`, línea 43](../src/components/EmailComposer.jsx#L43) | `const emailReportHtml =` | Une saludo, reporte HTML y despedida. |
| [`src/App.jsx`, línea 548](../src/App.jsx#L548) | `const handleEmail = async (form) => {` | Verifica condiciones de envío y maneja el resultado. |
| [`src/App.jsx`, línea 575](../src/App.jsx#L575) | `await sendInspectionEmail({ form });` | Llama al servicio EmailJS del frontend. |
| [`src/services/email.js`, línea 37](../src/services/email.js#L37) | `export async function sendInspectionEmail({ form }) {` | Valida configuración y prepara el envío del formulario. |
| [`src/services/email.js`, línea 52](../src/services/email.js#L52) | `await emailjs.sendForm(serviceId, templateId, form, { publicKey });` | Envía los datos mediante EmailJS. |
| [`src/services/inspectionExport.js`, línea 24](../src/services/inspectionExport.js#L24) | `export function createInspectionPdfFile(reportText, filename) {` | Construye el archivo PDF desde el texto del reporte. |
| [`src/services/inspectionExport.js`, línea 14](../src/services/inspectionExport.js#L14) | `export function downloadInspectionPdf(reportText, filename) {` | Descarga el archivo PDF generado. |

### Componentes de pantalla

| Archivo y línea | Fragmento exacto | Qué hace esa línea o su bloque |
|---|---|---|
| [`src/components/Header.jsx`, línea 5](../src/components/Header.jsx#L5) | `export default function Header({` | Inicia el encabezado, avisos y accesos rápidos. |
| [`src/components/Header.jsx`, línea 20](../src/components/Header.jsx#L20) | `src="/crearte-logo.png"` | Carga el logo desde los recursos públicos. |
| [`src/components/SummaryCards.jsx`, línea 9](../src/components/SummaryCards.jsx#L9) | `export default function SummaryCards({ lot }) {` | Presenta los valores resumidos del lote. |
| [`src/components/InspectionDatabase.jsx`, línea 15](../src/components/InspectionDatabase.jsx#L15) | `export default function InspectionDatabase({` | Inicia la lista y el detalle de inspecciones guardadas. |
| [`src/components/EmailComposer.jsx`, línea 4](../src/components/EmailComposer.jsx#L4) | `export default function EmailComposer({` | Inicia el formulario de destinatario, observaciones y adjuntos. |
| [`src/components/EmailComposer.jsx`, línea 69](../src/components/EmailComposer.jsx#L69) | `onPrepareEmail(formRef.current);` | Pasa el formulario al manejador de envío de `App`. |

### Estilos y configuración

| Archivo y línea | Fragmento exacto | Qué hace esa línea o su bloque |
|---|---|---|
| [`src/styles/global.css`, línea 2](../src/styles/global.css#L2) | `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');` | Importa las fuentes base de la interfaz. |
| [`src/styles/global.css`, línea 4](../src/styles/global.css#L4) | `:root {` | Define los valores globales de fuente y color. |
| [`src/styles/dashboard.css`, línea 2](../src/styles/dashboard.css#L2) | `.app-shell {` | Establece el contenedor y el fondo de la aplicación. |
| [`src/styles/dashboard.css`, línea 468](../src/styles/dashboard.css#L468) | `.roll-dialog-backdrop {` | Estiliza la capa que contiene el diálogo de rollos. |
| [`src/styles/dashboard.css`, línea 929](../src/styles/dashboard.css#L929) | `.summary-grid {` | Organiza las tarjetas resumen. |
| [`src/styles/dashboard.css`, línea 1078](../src/styles/dashboard.css#L1078) | `.analytics-grid {` | Organiza el área de gráficas. |
| [`src/styles/dashboard.css`, línea 1465](../src/styles/dashboard.css#L1465) | `@media (max-width: 900px) {` | Adapta el diseño a pantallas medianas. |
| [`src/styles/dashboard.css`, línea 1501](../src/styles/dashboard.css#L1501) | `@media (max-width: 650px) {` | Adapta el diseño a pantallas móviles. |
| [`src/styles/dashboard.css`, línea 1733](../src/styles/dashboard.css#L1733) | `@media print {` | Ajusta la página para imprimir. |
| [`src/styles/inspection.css`, línea 68](../src/styles/inspection.css#L68) | `.roll-table {` | Define el ancho y la estructura de la tabla de rollos. |
| [`src/styles/inspection.css`, línea 166](../src/styles/inspection.css#L166) | `.decision {` | Define el estilo común de las etiquetas de decisión. |
| [`src/styles/inspection.css`, línea 199](../src/styles/inspection.css#L199) | `@media (max-width: 650px) {` | Ajusta el formulario y la tabla en móvil. |
| [`package.json`, línea 7](../package.json#L7) | `"dev": "vite",` | Comando para iniciar el servidor de desarrollo. |
| [`package.json`, línea 8](../package.json#L8) | `"build": "vite build",` | Comando para compilar la aplicación. |
| [`package.json`, línea 12](../package.json#L12) | `"@emailjs/browser": "^5.0.3",` | Dependencia del servicio de correo usado por el frontend. |
| [`vite.config.js`, línea 5](../vite.config.js#L5) | `export default defineConfig({` | Inicia la configuración de Vite. |
| [`firebase.json`, línea 7](../firebase.json#L7) | `"public": "dist",` | Indica a Firebase Hosting la carpeta compilada. |
| [`firebase.json`, línea 16](../firebase.json#L16) | `"destination": "/index.html"` | Envía las rutas de Hosting a la aplicación React. |
| [`.env.example`, línea 1](../.env.example#L1) | `VITE_EMAILJS_SERVICE_ID=` | Nombre de la variable de configuración del servicio EmailJS. |

### Función Firebase no conectada al correo actual

| Archivo y línea | Fragmento exacto | Qué hace esa línea o su bloque |
|---|---|---|
| [`functions/index.js`, línea 18](../functions/index.js#L18) | `function normalizeText(value, maxLength) {` | Valida tipo y longitud de los textos del callable. |
| [`functions/index.js`, línea 29](../functions/index.js#L29) | `function decodeAttachments(input) {` | Valida y decodifica los adjuntos de esa función. |
| [`functions/index.js`, línea 78](../functions/index.js#L78) | `async function applyRateLimit(request) {` | Aplica el límite diario mediante Firestore. |
| [`functions/index.js`, línea 98](../functions/index.js#L98) | `exports.sendInspectionEmail = onCall(` | Declara el endpoint callable legado de Firebase. |
| [`functions/index.js`, línea 101](../functions/index.js#L101) | `enforceAppCheck: true,` | Exige App Check para llamadas a esa función. |
| [`functions/package.json`, línea 4](../functions/package.json#L4) | `"main": "index.js",` | Señala el archivo de entrada de la función. |

`package-lock.json`, `functions/package-lock.json` y `public/crearte-logo.png` no contienen líneas fuente editables: los primeros fijan versiones de dependencias y el último es una imagen. Para cambios futuros, revisa el contenido de cada línea enlazada y vuelve a comprobar su numeración; estos enlaces son una guía de lectura, no una copia del código.
