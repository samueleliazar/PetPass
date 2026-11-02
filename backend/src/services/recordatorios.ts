import { Types } from 'mongoose';
import { Recordatorio } from '../models/Recordatorio';
import { enviarPush } from './push';
const HORAS_ANTES = 48;

// Qué tipo de recordatorio genera cada tipo de registro del historial
const TIPO_POR_REGISTRO: Record<string, string> = {
  Vacuna: 'Vacuna',
  Tratamiento: 'Medicamento',
  Receta: 'Medicamento',
  Control: 'Tarea General',
};

interface DatosMascota {
  _id: Types.ObjectId;
  id_tutor: Types.ObjectId;
  nombre: string;
}

interface DatosEvento {
  _id: Types.ObjectId;
  tipo_registro: string;
  nombre: string;
  fecha_proxima_dosis?: Date | null;
}

// Crea, actualiza o borra el recordatorio de un registro según su próxima dosis (HU15)
export async function sincronizarRecordatorioDeEvento(mascota: DatosMascota, evento: DatosEvento) {
  // Solo se tocan los que aún no se envían ni se resuelven
  const pendiente = await Recordatorio.findOne({
    id_evento: evento._id,
    estado: { $in: ['Pendiente', 'Pospuesto'] },
  });

  const proxima = evento.fecha_proxima_dosis;
  const tipo = TIPO_POR_REGISTRO[evento.tipo_registro];

  // Sin próxima dosis, tipo sin recordatorio (Peso) o fecha ya pasada → no debe haber recordatorio
  if (!proxima || !tipo || proxima <= new Date()) {
    if (pendiente) await pendiente.deleteOne();
    return;
  }

  // 48 h antes; si ya estamos dentro de esas 48 h, se programa para ahora
  const fechaProgramada = new Date(
    Math.max(proxima.getTime() - HORAS_ANTES * 60 * 60 * 1000, Date.now())
  );
  const fechaTexto = proxima.toLocaleDateString('es-CL', { timeZone: 'UTC' });
  const titulo = `${evento.nombre} de ${mascota.nombre}`;
  const mensaje = `${mascota.nombre} tiene ${evento.nombre} programada para el ${fechaTexto}`;

  if (pendiente) {
    pendiente.set({
      titulo,
      mensaje,
      fecha_evento: proxima,
      fecha_programada: fechaProgramada,
      estado: 'Pendiente',
      tipo_recordatorio: tipo,
    });
    await pendiente.save();
  } else {
    await Recordatorio.create({
      id_mascota: mascota._id,
      id_tutor: mascota.id_tutor,
      id_evento: evento._id,
      titulo,
      mensaje,
      fecha_evento: proxima,
      fecha_programada: fechaProgramada,
      tipo_recordatorio: tipo,
    });
  }
}

// Borra el recordatorio pendiente de un registro que se eliminó
export async function eliminarRecordatorioDeEvento(idEvento: Types.ObjectId) {
  await Recordatorio.deleteMany({
    id_evento: idEvento,
    estado: { $in: ['Pendiente', 'Pospuesto'] },
  });
}
const ESTADOS_POR_ENVIAR = ['Pendiente', 'Pospuesto'];
const MAXIMO_POR_VUELTA = 200;

// HU16: envía el push de los recordatorios cuya hora de aviso ya llegó.
// Lo llama Cloud Scheduler cada hora (ruta POST /tareas/recordatorios).
export async function enviarRecordatoriosPendientes() {
  const candidatos = await Recordatorio.find({
    estado: { $in: ESTADOS_POR_ENVIAR },
    fecha_programada: { $lte: new Date() },
  })
    .sort({ fecha_programada: 1 })
    .limit(MAXIMO_POR_VUELTA)
    .lean();

  let enviados = 0;
  for (const r of candidatos) {
    // Se marca como Enviado ANTES de mandar el push; si dos llamadas llegan juntas,
    // solo una lo "toma" y el aviso no se repite
    const tomado = await Recordatorio.findOneAndUpdate(
      { _id: r._id, estado: { $in: ESTADOS_POR_ENVIAR } },
      { estado: 'Enviado', fecha_entrega: new Date() }
    );
    if (!tomado) continue;

    await enviarPush(r.id_tutor, {
      titulo: `🔔 ${r.titulo}`,
      cuerpo: r.mensaje,
      datos: { idMascota: String(r.id_mascota), idRecordatorio: String(r._id) },
    });
    enviados++;
  }

  console.log(`Recordatorios enviados: ${enviados}`);
  return enviados;
}