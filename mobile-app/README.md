# Mobile App - Portal Público de Agendamiento

Aplicación móvil React Native (Expo) conectada al mismo backend del portal público web.

## Requisitos

- Node.js 18+
- npm 9+
- Expo CLI (se usa vía `npx`)

## Configuración

1. Copia variables de entorno:

```bash
cp .env.example .env
```

2. Ajusta `EXPO_PUBLIC_API_BASE_URL` si usarás backend local o diferente dominio.

## Ejecutar

```bash
npm install
npm run start
```

Atajos:

- `a` abre Android
- `i` abre iOS (macOS)
- `w` abre Web

## Build APK (release) con versionado automático

Se agregó un flujo para compilar e instalar APK en un solo comando, guardando versiones en la carpeta `apk/`.

- Primera compilación: `axial-mobile-v0.1.apk`
- Siguientes compilaciones: incrementa automáticamente en `0.1` (`0.2`, `0.3`, etc.)

Comandos:

```bash
npm run apk:build
```

Este comando:
- Crea `apk/` si no existe
- Genera `android/` automáticamente si falta (Expo prebuild)
- Compila release con Gradle
- Guarda APK versionada en `apk/`
- Instala en dispositivo si hay ADB conectado

Instalar manualmente la última APK generada:

```bash
npm run apk:install
```

## Funcionalidades incluidas

- Login por documento
- Visualización de citas activas
- Agendar cita por especialidad/sede/agenda
- Fallback a lista de espera cuando no hay cupos
- Cancelar y reagendar citas
- Ver y marcar notificaciones SMS como leídas
- Actualizar teléfono del paciente
