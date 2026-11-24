# Manual de operación del cotizador

Guía para usar y mantener el cotizador sin conocimientos de programación.
Si hay un problema de configuración o de red, consulte también el `README.md`.

## 1. Encender el cotizador

### En Windows (PC de la empresa)

El proyecto ya **no está en OneDrive**. La carpeta que se usa es:

`C:\dev\cotizador`

1. Abra esa carpeta en el Explorador.
2. Haga doble clic en **`INICIAR.bat`**. (También puede abrir una terminal ahí y
   escribir `npm start`).
3. Deje esa ventana abierta mientras se use el cotizador.
4. Abra el navegador en **http://localhost:3100** o, desde otra PC de la red,
   en **http://192.168.1.115:3100**.

Al iniciar aparece un resumen con la versión, las direcciones, dónde se guardan
los datos (`C:\dev\cotizador\data`) y si hay contraseña. Si ve una línea que
diga **AVISO** o **POCO ESPACIO**, léala antes de seguir.

Si el cotizador va a quedar en internet (Render), la configuración es
obligatoria: usuario/contraseña y clave de administrador. Sin esos valores el
servidor se detiene solo al arrancar, a propósito, para no quedar abierto.

### Con Docker

```bash
docker run -d --name cotizador \
  -p 3100:3100 \
  -v cotizador_data:/app/data \
  -e BASIC_AUTH_USER=usuario \
  -e BASIC_AUTH_PASS=clave \
  cotizador_muestras
```

El contenedor corre con un usuario sin privilegios, guarda los datos en el
volumen `cotizador_data` y tiene su propio chequeo de salud.

## 2. Abrir la página

- En la misma PC: `http://localhost:3100`
- Desde otra PC de la red: `http://<IP-del-servidor>:3100`

La IP puede cambiar si el router reinicia. Para saberla, escriba `ipconfig` en
la PC del servidor y busque la dirección IPv4 de la tarjeta Wi-Fi o Ethernet.

Si la otra aplicación pone la autenticación, es posible que la contraseña la
pida esa aplicación y no el cotizador.

## 3. Comprobar que está bien

Abra `http://<IP-del-servidor>:3100/api/health` en el navegador.

- Ve `ok: true`: está bien.
- Ve `ok: false`: lea el texto en `problems`; dice qué falló.
- No abre nada: el servidor está apagado o la dirección es incorrecta.

También puede mirar el pie de la pantalla: ahí aparece la versión (por ejemplo
`v1.3.0`). Si dos equipos muestran versiones distintas, actualice el que esté
atrasado con `git pull`.

## 4. Trabajar con cotizaciones

1. En **Cotizar**, escriba el código de la referencia y espere el autocompletado.
2. Agregue las operaciones, cantidades y tiempos.
3. El resumen muestra SAM, costo y precio sugerido.
4. **Guardar** la deja en el historial. En **Historial** puede abrirla, borrarla
   y marcarla con el casillero para enviarla por correo.
5. En **Referencias** puede editar la marca de cada referencia.

Al guardar, cambiar parámetros, editar marcas, importar, crear/restaurar copias
o generar el Excel, el programa pide la **clave de administrador**. Se pregunta
una vez y se recuerda **solo mientras la pestaña siga abierta**: si cierra o
recarga la página, vuelve a pedirla. No la guarde en el navegador ni en un
documento.

Si el cotizador está en **solo lectura**, se puede consultar, calcular y generar
el correo, pero **no se puede guardar ni crear/restaurar copias**. Es una medida
de seguridad; avise a quien administra el servidor.

## 5. Hacer una copia de seguridad

En la pestaña **Importar**, bloque **Copias de seguridad**:

1. Apriete **Descargar copia actual**. Se baja un archivo `cotizador-respaldo-....json`.
2. Guarde ese archivo **fuera de la PC del servidor**: en Drive, otro equipo o un
   pendrive. Una copia que queda en el mismo equipo no sirve si el equipo falla.

Si va a actualizar el catálogo desde Excel, el archivo debe ser **.xlsx sin
macros**. Los antiguos `.xlsm` ya no se aceptan: convierta el archivo a `.xlsx`
antes de subirlo. Si el programa detecta macros, lo rechaza sin abrirlo.

También puede apretar **Crear copia ahora** para dejar una copia fechada en el
servidor. Se conservan las últimas 10 y se crean automáticamente antes de
importar, limpiar o restaurar datos.

En el recuadro se ve siempre cuántas copias hay, la última fecha, el espacio
libre en disco y si el **ensayo de restauración** dice `OK`.

## 6. Restaurar una copia

1. En **Importar → Copias de seguridad**, elija el archivo `.json` descargado.
2. Apriete **Probar esta copia**. Si dice *Copia válida*, anote cuántas
   operaciones y cotizaciones contiene. **Esto no cambia nada.**
3. Si la prueba salió bien, apriete **Restaurar desde esta copia**.
4. Confirme dos veces: primero *Aceptar* y después escribiendo `RESTAURAR`.

Antes de reemplazar los datos actuales se guarda una copia de ellos. Si se
arrepintió, use **Restaurar copia anterior** en la parte de importación.

## 7. Problemas comunes

| Síntoma | Qué hacer |
|---|---|
| "No hay conexión con el servidor" | Confirme que la ventana de `npm start` siga abierta y que la IP sea la correcta. |
| La pantalla muestra una versión vieja | Actualice con `git pull` y reinicie el servidor; luego recargue la página con `Ctrl + F5`. |
| Aparece "POCO ESPACIO" en el arranque | Libere espacio en el disco o aumente `DATA_DIR` antes de seguir guardando. |
| "/api/health" dice `ok: false` | Lea `problems`: puede ser falta de permisos de escritura o un archivo dañado. |
| Aparece un aviso de datos recuperados | El servidor encontró `store.json` dañado y usó la copia anterior. Revise las cotizaciones y guarde una copia nueva. |
| "Se requiere la clave de administrador" | Pida la clave a quien administra. Se pregunta al guardar o cambiar algo y se recuerda solo hasta que cierre la pestaña. |
| "ERROR de configuración en producción ... Arranque detenido" | En Render faltan el usuario/contraseña, la clave de administrador o hay un CORS abierto. Complete las variables y vuelva a desplegar. |
| El correo no llega | Revise el destinatario y que haya Internet: EmailJS envía desde el navegador. |

## 8. Apagar el servidor

En la ventana donde está corriendo, pulse `Ctrl + C`. El servidor termina lo que
estaba haciendo y cierra. No hace falta guardar nada antes: cada cambio ya se
escribe en disco.

## 9. Lo que este programa NO hace

- No pone el candado HTTPS: lo pone el servidor web o el proxy de la empresa.
- No crea copias fuera del servidor: descárguelas y guárdelas en otro lugar.
- No administra usuarios: en la PC funciona sin contraseña; en Render el usuario,
  la contraseña y la clave de administrador son obligatorios. Si otra aplicación
  hace el login, debe colocarse delante del cotizador.
- No avisa por correo si se cae: eso requiere un monitoreo externo.

El historial en Excel se genera solo con las cotizaciones marcadas y se envía
por EmailJS con un enlace de descarga; no se adjunta ningún archivo al correo.
