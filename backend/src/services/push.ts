import { Types } from 'mongoose';
import { Tutor } from '../models/Tutor';

type Aviso = {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, string>; // info extra para la app (ej: id de la mascota)
};

type RespuestaExpo = {
  data?: { status: 'ok' | 'error'; message?: string; details?: { error?: string } }[];
};

// Envía un push a todos los teléfonos del tutor usando el servicio gratuito de Expo
// (Expo se lo pasa a Firebase, que lo entrega al Android)
export async function enviarPush(idTutor: Types.ObjectId | string, aviso: Aviso) {
  const tutor = await Tutor.findById(idTutor).select('tokens_push').lean();
  const tokens = tutor?.tokens_push ?? [];
  if (tokens.length === 0) return; // el tutor no tiene la app con permiso de avisos

  const mensajes = tokens.map((to) => ({
    to,
    title: aviso.titulo,
    body: aviso.cuerpo,
    data: aviso.datos ?? {},
    sound: 'default',
    channelId: 'default', // el mismo canal que crea la app en src/push.ts
    priority: 'high',
  }));

  try {
    const r = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensajes),
    });
    const respuesta = (await r.json()) as RespuestaExpo;

    // Revisar cada envío: los tokens de teléfonos donde se desinstaló la app se borran
    const invalidos: string[] = [];
    respuesta.data?.forEach((resultado, i) => {
      if (resultado.status === 'error') {
        console.error(`Push con error (${resultado.details?.error ?? ''}): ${resultado.message ?? ''}`);
        if (resultado.details?.error === 'DeviceNotRegistered') invalidos.push(tokens[i]);
      }
    });
    if (invalidos.length) {
      await Tutor.updateOne({ _id: idTutor }, { $pull: { tokens_push: { $in: invalidos } } });
    }

    console.log(`Push "${aviso.titulo}" enviado a ${tokens.length} teléfono(s)`);
  } catch (e) {
    console.error('Error al enviar push:', e);
  }
}