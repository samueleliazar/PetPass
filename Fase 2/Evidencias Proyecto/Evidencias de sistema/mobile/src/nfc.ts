import { Platform } from 'react-native';

// La librería NFC solo existe en el development build (no en Expo Go).
// Se carga "con cuidado": si no está, la app sigue funcionando y solo se ocultan los botones NFC.
type ModuloNfc = typeof import('react-native-nfc-manager');
let modulo: ModuloNfc | null = null;
try {
  modulo = require('react-native-nfc-manager');
} catch {
  modulo = null;
}
let iniciado = false;

// ¿Este teléfono puede usar NFC con PetPass? (solo Android, y solo en el development build)
export async function nfcDisponible(): Promise<boolean> {
  if (Platform.OS !== 'android' || !modulo) return false;
  try {
    const NfcManager = modulo.default;
    if (!(await NfcManager.isSupported())) return false;
    if (!iniciado) {
      await NfcManager.start();
      iniciado = true;
    }
    return true;
  } catch {
    return false;
  }
}

// ¿El usuario tiene el NFC encendido en Ajustes?
export async function nfcActivado(): Promise<boolean> {
  try {
    return (await modulo?.default.isEnabled()) ?? false;
  } catch {
    return false;
  }
}

// HU18: espera a que se acerque un chip y devuelve su identificador único (UID), ej: "04A2245ABC6880"
export async function leerUid(): Promise<string> {
  const { default: NfcManager, NfcTech } = modulo!;
  try {
    // Acepta stickers NFC y también otras tarjetas (útil para probar)
    await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA, NfcTech.IsoDep, NfcTech.MifareClassic]);
    const tag = await NfcManager.getTag();
    if (!tag?.id) throw new Error('No se pudo leer el identificador del chip');
    return tag.id.replace(/[^0-9a-f]/gi, '').toUpperCase();
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

// HU21: escribe en el chip la URL de la ficha, para que cualquier teléfono la abra al acercarse
export async function grabarUrl(url: string): Promise<void> {
  const { default: NfcManager, NfcTech, Ndef } = modulo!;
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
    if (!bytes) throw new Error('No se pudo preparar el enlace');
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

// Para el botón "Cancelar" mientras se espera el chip
export function cancelarNfc() {
  modulo?.default.cancelTechnologyRequest().catch(() => {});
}