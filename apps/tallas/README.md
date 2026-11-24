# Estado set de tallas

## Configurar el envío de correo con EmailJS

1. Crea un servicio de correo y una plantilla en [EmailJS](https://www.emailjs.com/).
2. Copia `.env.example` como `.env.local` en la raíz del proyecto y completa:
   - `VITE_EMAILJS_SERVICE_ID`: ID del servicio.
   - `VITE_EMAILJS_TEMPLATE_ID`: ID de la plantilla.
   - `VITE_EMAILJS_PUBLIC_KEY`: Public Key de EmailJS.
3. Configura **To Email** como `{{to_email}}` y **Subject** como `{{subject}}`.
4. En el editor de la plantilla, cambia el cuerpo a modo HTML y deja `{{{html_body}}}` como contenido del mensaje. Reemplaza el texto de ejemplo como `{{name}}` o `{{message}}`; si los dejas, EmailJS enviará ese texto además del diseño. Las tres llaves permiten insertar el HTML sin escapar sus etiquetas.
5. Guarda la plantilla, reinicia la aplicación si acabas de modificar `.env.local` y escribe el destinatario en el campo **Enviar a**. La dirección se recuerda en ese navegador.

El correo usa un diseño corporativo adaptable e incluye la referencia, OC, marca, fecha, unidades, observaciones o motivo y quién diligenció el registro. El estado aparece en verde para aprobado, amarillo para pendiente y rojo para rechazado. Al guardar un resultado en auditoría final se abre la ventana para enviar el aviso, incluidos los resultados aprobados; pulsa **Enviar correo** para confirmar el envío.

El botón confirma el resultado que devuelve EmailJS. El tiempo real de entrega depende del servicio de correo y del proveedor del destinatario. La Public Key está diseñada para uso en el navegador; no pongas una Private Key en variables `VITE_*`. Restringe los dominios permitidos desde la configuración de seguridad de EmailJS.
