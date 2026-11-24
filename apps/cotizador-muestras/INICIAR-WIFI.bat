@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ========================================
echo  COTIZADOR DE MUESTRAS - INICIO WI-FI/LAN
echo ========================================

REM Cargar .env local si existe
if exist ".env" (
  echo [INFO] Cargando variables desde .env
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    set "KEY=%%A"
    set "VAL=%%B"
    if not "!KEY!"=="" set "!KEY!=!VAL!"
  )
) else (
  echo [INFO] No se encontro .env; se usaran valores por defecto.
)

if "%PORT%"=="" set "PORT=3100"
if "%HOST%"=="" set "HOST=0.0.0.0"

REM Detectar IPv4 local activa (omite loopback/APIPA 169.254.x.x)
set "LAN_IP_DETECTED="
for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /R /C:"IPv4.*: [0-9]"') do (
  for /f "tokens=1 delims= " %%A in ("%%I") do (
    set "CANDIDATE=%%A"
    if not "!CANDIDATE!"=="" if not "!CANDIDATE:~0,4!"=="169." set "LAN_IP_DETECTED=!CANDIDATE!"
  )
)

if defined LAN_IP_DETECTED (
  set "PUBLIC_BASE_URL=http://!LAN_IP_DETECTED!:%PORT%"
  set "LAN_IP=!LAN_IP_DETECTED!"
  echo [INFO] IP local detectada: !LAN_IP_DETECTED!
) else (
  echo [AVISO] No se pudo detectar IPv4 local. Se usara PUBLIC_BASE_URL existente o localhost.
)

echo.
echo Configuracion efectiva:
echo   HOST=%HOST%
echo   PORT=%PORT%
if defined PUBLIC_BASE_URL (echo   PUBLIC_BASE_URL=%PUBLIC_BASE_URL%) else (echo   PUBLIC_BASE_URL=(no definida))
if defined BASIC_AUTH_USER (echo   Autenticacion basica: ACTIVA) else (echo   Autenticacion basica: NO configurada)
if defined ADMIN_TOKEN (echo   Token admin: ACTIVO) else (echo   Token admin: NO configurado)
if "%READ_ONLY%"=="1" (echo   Modo solo lectura: ACTIVO) else (echo   Modo solo lectura: NO)

echo.
echo URLs de acceso:
echo   Local:    http://localhost:%PORT%
if defined LAN_IP_DETECTED (
  echo   Red/Wi-Fi: http://!LAN_IP_DETECTED!:%PORT%
  echo.
  echo Comparta la URL de Red/Wi-Fi con usuarios en la misma oficina/red.
  echo Los enlaces de Excel en correos usaran PUBLIC_BASE_URL=%PUBLIC_BASE_URL%
) else (
  echo   Red/Wi-Fi: no detectada automaticamente
)
echo.
echo Iniciando servidor... (Ctrl+C para detener)
echo.
node src\server.js
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo El servidor se detuvo (codigo %EXIT_CODE%).
pause
endlocal & exit /b %EXIT_CODE%
