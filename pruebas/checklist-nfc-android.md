# Checklist de pruebas: NFC (HU18, HU19, HU21) y Android (HU28)

**Servidor:** https://petpass-api-658804397148.southamerica-east1.run.app
**Build:** development (EAS), Expo SDK 58

## Dispositivos usados (HU28)

| # | Dueño | Modelo | Versión de Android | ¿Tiene NFC? |
|---|---|---|---|---|
| A | Daniel | vivo Y36 5G | Android 13 | No |
| B | Matías | | | |
| C | (otro, idealmente el más antiguo disponible) | | | |
| iPhone | Samuel | | iOS | Solo lectura (sin app) |

> HU28 pide Android 8 o superior. La versión se ve en Ajustes → Acerca del teléfono.

---

## 0. Preparación (en cada PC con Android)

- [ ] `git pull` en la raíz
- [ ] En `mobile`: `npx rimraf node_modules` y luego `npm install` (proyecto en SDK 58)
- [ ] `mobile/.env` apunta a Cloud Run (São Paulo) — **obligatorio para grabar medallas**
- [ ] Instalar el APK del build (enlace de expo.dev de Samuel) → permitir "Instalar apps desconocidas"
- [ ] En el PC: `cd mobile` → `npx expo start -c --offline --dev-client` (mismo Wi-Fi que el teléfono)
- [ ] Abrir la app "mobile" del build → elegir el PC o escanear el QR desde la app
- [ ] NFC encendido en Ajustes
- [ ] Un código de placa por sticker: en `backend`, `npm run placa:nueva -- 3` (escribirlo en el sticker)

---

## 1. NFC (HU18, HU19, HU21, HU25)

| # | Prueba | Pasos | Resultado esperado | Disp. | ✅/❌ | Observaciones |
|---|---|---|---|---|---|---|
| N1 | Botones NFC visibles | Abrir 🏷️ Medalla en el build de Android | Aparece "📶 Leer chip NFC" (o "Grabar" si hay medalla activa) | A |❌| |
| N2 | NFC apagado | Apagar NFC → tocar el botón | Aviso "NFC apagado" | B | | |
| N3 | Leer UID | Mascota sin medalla → código → "Leer chip" → acercar sticker | "📶 Chip leído: 04…" | B | | |
| N4 | Cancelar lectura | "Leer chip" → "Cancelar" | Vuelve sin mensaje de error | B | | |
| N5 | Vincular con UID (HU18) | Tras N3 → "Vincular" | "✅ Medalla activa" | B | | |
| N6 | UID guardado | Postman o Atlas: ver la mascota | `medalla.uid_nfc` tiene el UID | — | | |
| N7 | Grabar enlace (HU21) | "📶 Grabar enlace en el chip" → acercar sticker | "¡Listo! El chip ya abre la ficha…" | B | | |
| N8 | Abrir ficha con NFC (Android) | Teléfono **sin la app abierta** → acercar al sticker | Se abre el navegador con la ficha en < 2 s | B | | |
| N9 | Abrir ficha con NFC (iPhone) | iPhone de Samuel, pantalla desbloqueada → acercar al sticker | Notificación → abre la ficha | iPhone | | |
| N10 | Escaneo registrado (HU25) | Tras N8 → 📡 Escaneos | Aparece un escaneo por NFC 📶 | B | | |
| N11 | Correo de aviso (HU25) | Logs de Cloud Run tras N8 | Aparece el enlace de Ethereal con el aviso | — | | |
| N12 | Mismo chip en otra mascota | Otra cuenta → vincular leyendo el mismo sticker | Error (UID ya usado) | B | | |
| N13 | Desvincular (HU19) | Desvincular → acercar el sticker | La ficha dice "Medalla no encontrada" | B | | |
| N14 | Reemplazar | Vincular un sticker nuevo y grabarlo | El nuevo abre la ficha; el antiguo no | B | | |
| N15 | Tarjeta que no es sticker | "Leer chip" con una tarjeta bancaria/TNE | Lee un UID o da error sin cerrarse la app | B | | |
| N16 | Teléfono sin NFC | Abrir 🏷️ Medalla en el build, en un teléfono sin NFC | No aparecen botones NFC y la app no se cae | A |✅ |No aparece nada relacionado al NFC y no se cae.|

---

## 2. Android (HU28): recorrido por pantallas

| # | Pantalla / función | Qué revisar | A | B | C | Observaciones |
|---|---|---|---|---|---|---|
| D1 | Registro e inicio de sesión | Crear cuenta, entrar, cerrar sesión |A|| |✅ Permite crear, entrar y también cerrar sesión. Nota: La app mostraba los textos en blanco, ya que estaba pensada con colores claros y porque mi teléfono estaba en modo oscuro, agregué una línea de comando que deja la app siempre en modo claro, para que nadie tenga problema.|
| D2 | Recuperar contraseña | "¿Olvidaste tu contraseña?" → mensaje |A|| |✅ El sistema de recuperado de contraseña funciona correctamente, sigue enviándose a Ethereal por ahora. |
| D3 | Lista de mascotas | Se ve completa, nada tapado por la barra |A| | |✅ Se ve bien, pero en términos de diseño,  el botón de recordatorios está muy cerca del texto que dice "Mis Mascotas", el botón de abajo que dice "Agregar Mascota", está en la mitad de la barra de mi teléfono, la que lleva al inicio, volver atrás, etc, hay que revisar eso, pero el botón se sigue pudiendo presionar.|
| D4 | Crear y editar mascota | Especie, raza, fecha, alergias, condiciones |A| | |✅ Puede editarse todo eso sin problemas, pero el gran detalle que veo es que no se actualiza el cambio al salir de la pantalla de edición, sino que hay que volver a la lista de mascotas, seleccionar la mascota y recién ahí se actualiza con los cambios.|
| D5 | Foto de perfil | Cámara y galería, permiso de cámara |A| | |✅ La cámara pide los permisos correspondientes para ingresar y tomar fotos, se puede subir la foto y dejarla como foto de perfil sin problemas, con la galería es casi lo mismo, pero no pide permisos para ingresar a la galería, llega y entra sin más|
| D6 | Historial | Filtros, ＋ Registrar, "📄 Ver original" |A| | |✅ Se ven los filtros y el botón de registrar, también el "Ver original" en caso de que se escanee con OCR .|
| D7 | Historial por clínica | Tarjetas desplegables |A| | |✅ Tarjetas desplegadas correctamente, se ve bien, sin ningún detalle|
| D8 | OCR | Escanear carnet → texto → confirmar → agregar al historial |A| | |✅ Escanea el carnet, desde galería lo probé, cabe recalcar, se agrega correctamente.|
| D9 | Recordatorios | Lista, ✓ Hecho, posponer, nuevo recordatorio |A| | |✅ Está funcionando correctamente |
| D10 | Extravío | Reportar → aviso rojo → ¡La encontré! |A| | |✅ Funciona correctamente, el único detalle, que junto a otras funciones, no se actualiza automáticamente al volver a la interfaz de la mascota, sino que hay que volver un paso a atrás y nuevamente volver a la mascota en particular.|
| D11 | Privacidad | Interruptores → cambia la ficha pública |A| | |✅ Los interruptores se pueden mover, quedan actualizados, todo correcto. |
| D12 | Medalla y QR | QR visible, Compartir abre el menú de Android |A| | |✅ QR visible y permite compartir, el link se ve bien, y se abré correctamente el menú de Android.|
| D13 | Escaneos | Agrupados por extravío |A| | |✅ Se ven perfectamente agrupados por extravío.|
| D14 | Perfil | Editar teléfono, cerrar sesión |A| | |✅ Permite editar sin problemas, aunque no valida la cantidad de números ni si el teléfono es válido, cierra sesión sin problemas.|
| D15 | Teclado | Los campos no quedan tapados por el teclado |A| | |❌ En varios apartados que probé si los tapaba el teclado, hay que revisar eso.|
| D16 | Botón "atrás" de Android | Vuelve a la pantalla anterior sin cerrar la app |A| | |✅ El botón hacia atrás cumple su función correctamente.|
| D17 | Tamaño de letra grande | La app sigue usable |A| | |✅ Las letras grandes permiten ver todo correctamente, no obstruyen nada.|

---

## 3. Resultado

- Pruebas aprobadas: 16 / 33
- Problemas encontrados (y si se corrigieron):
  1. La interfaz tiene detalles con la distribución de botones o textos, hay que corregir las posiciones y tamanios.
  2. Hay varios campos de texto que son tapados por el teclado, no es muy reactiva la app cuando aparece el teclado.
  3. Cuando se hace un cambio en la ficha del animal, como por ejemplo, agregar una alergia, no se actualiza automáticamente en el front end al guardar, sino que hay que volver atrás manualmente a la lista de fichas de las mascotas y volver nuevamente a la mascota en particular para recién poder visualizar el cambio. Está en varios apartados que tienen que ver con cambiar algo de la ficha. 
- Capturas guardadas en: (carpeta compartida del grupo, **sin datos personales reales**)