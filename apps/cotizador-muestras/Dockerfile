FROM node:20-slim-bookworm

# El proceso corre con un usuario sin privilegios: si algo se rompe dentro del
# contenedor no puede modificar el sistema, solo su carpeta /app/data.
RUN groupadd --system cotizador \
 && useradd --system --gid cotizador --home-dir /app --no-create-home cotizador \
 && mkdir -p /app/data/exports /app/data/backups \
 && chown -R cotizador:cotizador /app

WORKDIR /app

# Primero las dependencias: Docker reutiliza esta capa si solo cambia el código.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY data/catalog.json ./data/catalog.json

USER cotizador

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3100 \
    DATA_DIR=/app/data

VOLUME ["/app/data"]
EXPOSE 3100

# El servidor guarda cada cambio en disco y cierra ordenadamente con SIGTERM.
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
