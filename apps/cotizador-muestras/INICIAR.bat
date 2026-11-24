@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ========================================
echo  COTIZADOR DE MUESTRAS - INICIO LOCAL
echo ========================================

REM Cargar .env local si existe (formato KEY=VALUE, sin espacios alrededor de =)
if exist ".env" (
  echo [INFO] Cargando variables desde .env
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    set "KEY=%%A"
    set "VAL=%%B"
    if not "!KEY!"=="" set "!KEY!=!VAL!"
  )
) else (
  echo [INFO] No se encontro .env; se usaran valores por defecto/.env.example como referencia.
)

if "%PORT%"=="" set "PORT=3100"
if "%HOST%"=="" set "HOST=0.0.0.0"

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
echo   Local:   http://localhost:%PORT%
echo   Red/Wi-Fi: configure PUBLIC_BASE_URL o use INICIAR-WIFI.bat para detectar IP.
echo.
echo Iniciando servidor... (Ctrl+C para detener)
echo.
node src\server.js
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo El servidor se detuvo (codigo %EXIT_CODE%).
pause
endlocal & exit /b %EXIT_CODE%
