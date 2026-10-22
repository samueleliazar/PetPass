import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Las dos librerías leen la llave desde GOOGLE_APPLICATION_CREDENTIALS (.env).
// En Cloud Run no hará falta la llave: usan la cuenta de servicio del servidor.
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const vision = new ImageAnnotatorClient();

function bucket() {
  const nombre = process.env.GCS_BUCKET;
  if (!nombre) throw new Error('Falta GCS_BUCKET en el .env');
  return storage.bucket(nombre);
}

// HU13: sube la foto original. ifGenerationMatch: 0 = solo si NO existe:
// así es imposible sobrescribir una foto ya guardada.
export async function subirImagen(contenido: Buffer, tipo: string, idMascota: string) {
  const extension = tipo === 'image/png' ? 'png' : 'jpg';
  const ruta = `mascotas/${idMascota}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
  await bucket().file(ruta).save(contenido, {
    contentType: tipo,
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
  });
  return ruta;
}

// El bucket es privado: para ver la foto se genera un enlace temporal (15 minutos)
export async function urlTemporal(ruta: string) {
  const [url] = await bucket().file(ruta).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  });
  return url;
}

// HU11: lee el texto de la foto con Cloud Vision
export async function leerTexto(contenido: Buffer) {
  const [resultado] = await vision.documentTextDetection({
    image: { content: contenido },
    imageContext: { languageHints: ['es'] },
  });
  const texto = resultado.fullTextAnnotation?.text ?? '';
  const bloques = (resultado.fullTextAnnotation?.pages ?? []).flatMap((p) => p.blocks ?? []);
  const confianza = bloques.length
    ? bloques.reduce((suma, b) => suma + (b.confidence ?? 0), 0) / bloques.length
    : 0;
  return { texto, confianza: Math.round(confianza * 1000) / 1000 };
}
// Borra todas las fotos de una mascota (al eliminar la mascota, HU06)
export async function borrarImagenesDeMascota(idMascota: string) {
  await bucket().deleteFiles({ prefix: `mascotas/${idMascota}/` });
}
// Borra un archivo del bucket (por ejemplo, la foto de perfil anterior)
export async function borrarArchivo(ruta: string) {
  await bucket().file(ruta).delete({ ignoreNotFound: true });
}

// Enlace temporal de una foto, o null si no hay foto (si Google falla, no rompe la pantalla)
export async function fotoTemporal(ruta?: string | null) {
  if (!ruta) return null;
  try {
    return await urlTemporal(ruta);
  } catch (e) {
    console.error('No se pudo generar el enlace de la foto:', e);
    return null;
  }
}