import crypto from 'crypto';

// Clave con la que se "firman" los códigos de las placas.
// En desarrollo hay un valor por defecto, así los tres integrantes generan placas compatibles.
// En producción se debe definir PLACA_SECRET en el .env del servidor.
function secreto() {
  return process.env.PLACA_SECRET ?? 'petpass-placas-desarrollo';
}

function firmar(base: string) {
  return crypto.createHmac('sha256', secreto()).update(base).digest('hex').slice(0, 12).toUpperCase();
}

// Genera un código de placa nuevo: PP-<12 caracteres aleatorios>-<12 de firma>
export function generarUuidPlaca() {
  const base = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `PP-${base}-${firmar(base)}`;
}

// HU18: verifica que el código sea una placa auténtica de PetPass
export function esPlacaValida(uuid: string) {
  const partes = /^PP-([0-9A-F]{12})-([0-9A-F]{12})$/.exec(uuid);
  if (!partes) return false;
  const esperada = firmar(partes[1]);
  // Comparación en tiempo constante (buena práctica al comparar firmas)
  return crypto.timingSafeEqual(Buffer.from(partes[2]), Buffer.from(esperada));
}

// HU18: token público aleatorio y no secuencial que forma la URL de emergencia
export function generarTokenPublico() {
  return crypto.randomBytes(16).toString('base64url');
}

export function urlEmergencia(token: string) {
  const base = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  return `${base}/e/${token}`;
}