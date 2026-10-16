import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const CLAVE_TOKEN = 'petpass_token';

// ---- Token de sesión (guardado de forma segura en el teléfono) ----
export async function guardarToken(token: string) {
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}

export async function obtenerToken() {
  return SecureStore.getItemAsync(CLAVE_TOKEN);
}

export async function borrarToken() {
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}

// ---- Llamadas al backend ----
// Agrega el token si existe y convierte los errores del backend en mensajes legibles
export async function api<T>(
  ruta: string,
  opciones: { metodo?: string; cuerpo?: unknown } = {}
): Promise<T> {
  if (!API_URL) throw new Error('Falta EXPO_PUBLIC_API_URL en mobile/.env');

  const token = await obtenerToken();
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(datos.error ?? `Error ${respuesta.status}`);
  }
  return datos as T;
}