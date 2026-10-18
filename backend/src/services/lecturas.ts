import { Types } from 'mongoose';
import { LecturaEmergencia } from '../models/LecturaEmergencia';
import { Tutor } from '../models/Tutor';
import { enviarCorreo } from '../config/correo';

// HU25: bots de vista previa (WhatsApp, Telegram, Facebook, etc.) y programas automáticos
const BOTS =
  /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|linkedin|embedly|curl|wget|python-requests|headless/i;

export function esBot(userAgent?: string) {
  return !userAgent || BOTS.test(userAgent);
}

const MINUTOS_ENTRE_AVISOS = 10;

type DatosLectura = {
  idMascota: Types.ObjectId;
  idTutor: Types.ObjectId;
  nombreMascota: string;
  uuidPlaca: string | null;
  idAlerta: Types.ObjectId | null;
  canal: 'NFC' | 'QR';
  userAgent?: string;
};

export async function registrarLectura(d: DatosLectura) {
  // Los bots no cuentan como escaneo: no se guardan ni avisan
  if (esBot(d.userAgent)) return;

  // ¿Hubo otro escaneo hace poco? (se revisa ANTES de guardar el nuevo)
  const desde = new Date(Date.now() - MINUTOS_ENTRE_AVISOS * 60 * 1000);
  const huboReciente = await LecturaEmergencia.exists({
    id_mascota: d.idMascota,
    fecha_hora: { $gte: desde },
  });

  await LecturaEmergencia.create({
    id_mascota: d.idMascota,
    uuid_placa: d.uuidPlaca,
    id_alerta: d.idAlerta,
    canal: d.canal,
    user_agent: d.userAgent?.slice(0, 500) ?? null,
  });

  if (huboReciente) return; // ya se avisó hace menos de 10 minutos

  const tutor = await Tutor.findById(d.idTutor).select('email nombre_completo').lean();
  if (!tutor) return;

  const hora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });
  const extra = d.idAlerta
    ? '<p><b>Tu mascota está reportada como extraviada: alguien podría haberla encontrado.</b></p>'
    : '';

  // TODO HU16: cuando esté Firebase, enviar aquí también una notificación push
  await enviarCorreo(
    tutor.email,
    `🐾 Escanearon la medalla de ${d.nombreMascota}`,
    `<p>Hola ${tutor.nombre_completo}:</p>
     <p>Alguien escaneó la medalla de <b>${d.nombreMascota}</b> el ${hora} (por ${d.canal}).</p>
     ${extra}
     <p>Si tienes tu teléfono visible en la ficha, es posible que te llamen pronto.</p>`
  );
}