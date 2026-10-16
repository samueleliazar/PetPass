import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const CLAVE_TOKEN = 'petpass_token';

// Error que además guarda el código HTTP (400, 401, 404...)
export class ErrorApi extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.status = status;
  }
}

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
    throw new ErrorApi(datos.error ?? `Error ${respuesta.status}`, respuesta.status);
  }
  return datos as T;
}