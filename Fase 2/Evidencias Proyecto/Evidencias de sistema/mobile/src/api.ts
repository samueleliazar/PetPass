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
// Sube un archivo (por ejemplo, la foto de un carnet) como form-data.
// Usa XMLHttpRequest porque el fetch de Expo no acepta archivos { uri, name, type } en FormData.
export async function subirArchivo<T>(
  ruta: string,
  campo: string,
  archivo: { uri: string; nombre: string; tipo: string }
): Promise<T> {
  if (!API_URL) throw new Error('Falta EXPO_PUBLIC_API_URL en mobile/.env');
  const token = await obtenerToken();

  const datos = new FormData();
  datos.append(campo, { uri: archivo.uri, name: archivo.nombre, type: archivo.tipo } as unknown as Blob);

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${ruta}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // OJO: NO se pone Content-Type; se arma solo con el "boundary" del form-data
    xhr.timeout = 60000; // 60 s: el OCR puede tardar

    xhr.onload = () => {
      let cuerpo: { error?: string } = {};
      try {
        cuerpo = JSON.parse(xhr.responseText);
      } catch {
        // la respuesta no era JSON
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(cuerpo as T);
      } else {
        reject(new ErrorApi(cuerpo.error ?? 'Error del servidor', xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error('No se pudo conectar con el servidor. Revisa tu conexión.'));
    xhr.ontimeout = () =>
      reject(new Error('El servidor tardó demasiado en responder. Revisa tu conexión e intenta de nuevo.'));

    xhr.send(datos);
  });
}