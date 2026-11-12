# PetPass 🐾

**Libreta clínica digital para mascotas, con medalla de emergencia NFC/QR.**

Proyecto APT · Duoc UC · Matías Araneda, Daniel Cuevas y Samuel Reyes.

PetPass centraliza el historial médico de perros y gatos y permite que cualquier persona que encuentre una mascota vea sus datos críticos y avise al tutor con solo acercar el teléfono a la medalla del collar (NFC) o escanear su código QR, sin instalar nada.

## Funcionalidades

- **Ficha clínica:** vacunas, tratamientos, recetas, controles y peso, con filtros y vista agrupada por clínica. Alergias y condiciones críticas destacadas.
- **Carnet por foto (OCR):** Google Cloud Vision extrae el texto; el tutor lo revisa antes de guardarlo y la foto original queda de respaldo.
- **Recordatorios:** se crean solos desde la próxima dosis y llegan por notificación push 48 horas antes. También hay recordatorios generales.
- **Medalla NFC + QR:** abre una ficha web de emergencia en menos de 2 segundos, con privacidad configurable por campo.
- **Extravío:** aviso en la ficha pública, push y correo al tutor en cada escaneo, y registro de escaneos por episodio.

## Stack

| Capa | Tecnología |
|---|---|
| App móvil (Android) | React Native, Expo SDK 58, expo-router, react-native-nfc-manager, expo-notifications |
| API | Node.js 24, Express 5, TypeScript, Mongoose |
| Base de datos | MongoDB Atlas (AWS São Paulo) |
| Nube | Google Cloud Run (southamerica-east1), Cloud Storage, Cloud Vision, Secret Manager, Cloud Scheduler, Cloud Monitoring |
| Notificaciones y correo | Expo Push + Firebase Cloud Messaging; Gmail SMTP |
| Builds | EAS (organización `petpass-duoc`) |
| Pruebas | Postman, Apache JMeter, checklist manual en dispositivos |

## Estructura

```
backend/   API REST (src/config, middleware, models, routes, services, scripts)
mobile/    App Expo (src/app con las pantallas, api.ts, nfc.ts, push.ts, app.json, eas.json)
pruebas/   Plan de JMeter y checklist de pruebas en Android
Fase 1/    Documentación de definición
Fase 2/    Documentación de desarrollo
```

## Puesta en marcha

Requisitos: Node.js 24+, Git y un teléfono Android (Expo Go o el APK de desarrollo).

### Backend

```bash
cd backend
npm install
# crear backend/.env (ver tabla) y la llave en backend/credenciales/gcp-petpass.json
npm run dev
# http://localhost:3000/health  →  {"estado":"ok","db":"conectada"}
```

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | Conexión a MongoDB Atlas (secreto) |
| `JWT_SECRET` | Firma de los tokens de sesión (secreto) |
| `PUBLIC_URL` | URL base de los enlaces de la medalla y los correos |
| `GCP_PROJECT_ID`, `GCS_BUCKET` | Proyecto y bucket de Google Cloud |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta a la llave JSON (solo en local) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Correo real; sin ellas se usa Ethereal |
| `TAREAS_CLAVE` | Clave de la ruta `/tareas/recordatorios` (secreto) |

Scripts: `npm run build`, `npm start`, `npm run placa:nueva -- N` (códigos de medalla), `npm run ocr:probar`.

### App

```bash
cd mobile
npm install
# mobile/.env
EXPO_PUBLIC_API_URL=https://petpass-api-658804397148.southamerica-east1.run.app

npx expo start -c --offline --go          # Expo Go
npx expo start -c --offline --dev-client  # APK de desarrollo (NFC y push)
```

### Publicar

```bash
cd backend
npm run build
gcloud run deploy petpass-api --source . --region southamerica-east1
```

No usar `--set-env-vars`. Para agregar variables o secretos: `--update-env-vars` / `--update-secrets`.

### APK

```bash
cd mobile
eas build --profile preview --platform android      # APK independiente
eas build --profile development --platform android  # APK de desarrollo
```

## Seguridad

Nunca subir `.env`, `credenciales/`, llaves JSON ni tokens. Las claves de producción están en Secret Manager y en expo.dev.

## Documentación

Product Vision, Product Backlog, Sprint Backlog, Definition of Done, Documento de diseño, Retrospectivas, Plan de pruebas y Manual técnico y de despliegue (carpeta `Fase 2/`).