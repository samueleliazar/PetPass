import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Recordatorio, ESTADOS_RECORDATORIO } from '../models/Recordatorio';
import { Mascota } from '../models/Mascota';
import { requiereAuth } from '../middleware/auth';

export const recordatoriosRouter = Router();
recordatoriosRouter.use(requiereAuth);

// GET /recordatorios?estado=Pendiente → recordatorios del tutor, del más próximo al más lejano
recordatoriosRouter.get('/', async (req, res) => {
  const { estado } = req.query;
  if (estado !== undefined && (typeof estado !== 'string' || !ESTADOS_RECORDATORIO.includes(estado))) {
    res.status(400).json({ error: `Estado no válido. Opciones: ${ESTADOS_RECORDATORIO.join(', ')}` });
    return;
  }

  const filtro: Record<string, unknown> = { id_tutor: res.locals.tutorId };
  if (estado) filtro.estado = estado;

  const recordatorios = await Recordatorio.find(filtro)
    .populate('id_mascota', 'nombre')
    .sort({ fecha_programada: 1 });

  res.json(recordatorios);
});

// Estados en que el recordatorio todavía admite acciones
const ESTADOS_ABIERTOS = ['Pendiente', 'Pospuesto', 'Enviado'];

// Busca un recordatorio del tutor que inició sesión
async function buscarRecordatorio(id: string, tutorId: string) {
  if (!isValidObjectId(id)) return null;
  return Recordatorio.findOne({ _id: id, id_tutor: tutorId });
}

// POST /recordatorios → crea un recordatorio general (HU37)
recordatoriosRouter.post('/', async (req, res) => {
  const { id_mascota, titulo, mensaje, fecha } = req.body ?? {};

  if (typeof id_mascota !== 'string' || !isValidObjectId(id_mascota)) {
    res.status(400).json({ error: 'Debes indicar la mascota' });
    return;
  }
  const esSuya = await Mascota.exists({ _id: id_mascota, id_tutor: res.locals.tutorId });
  if (!esSuya) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }
  if (typeof titulo !== 'string' || titulo.trim() === '') {
    res.status(400).json({ error: 'El título es obligatorio' });
    return;
  }
  if (typeof mensaje !== 'string' || mensaje.trim() === '') {
    res.status(400).json({ error: 'El mensaje es obligatorio' });
    return;
  }
  const cuando = new Date(fecha);
  if (typeof fecha !== 'string' || isNaN(cuando.getTime())) {
    res.status(400).json({ error: 'Fecha no válida (ejemplo: 2026-11-05 o 2026-11-05T10:00)' });
    return;
  }
  if (cuando <= new Date()) {
    res.status(400).json({ error: 'La fecha debe ser futura' });
    return;
  }

  const recordatorio = await Recordatorio.create({
    id_mascota,
    id_tutor: res.locals.tutorId,
    id_evento: null, // HU37: sin enlace al historial clínico
    titulo: titulo.trim(),
    mensaje: mensaje.trim(),
    fecha_evento: cuando,
    fecha_programada: cuando, // una tarea general se avisa en la fecha indicada
    tipo_recordatorio: 'Tarea General',
  });

  res.status(201).json(recordatorio);
});

// PATCH /recordatorios/:id/realizado → marca como realizado y sugiere registrar la dosis (HU17)
recordatoriosRouter.patch('/:id/realizado', async (req, res) => {
  const recordatorio = await buscarRecordatorio(req.params.id, res.locals.tutorId);
  if (!recordatorio) {
    res.status(404).json({ error: 'Recordatorio no encontrado' });
    return;
  }
  if (!ESTADOS_ABIERTOS.includes(recordatorio.estado ?? '')) {
    res.status(400).json({ error: `El recordatorio ya está ${recordatorio.estado}` });
    return;
  }

  recordatorio.estado = 'Realizado';
  await recordatorio.save();

  // Si viene de una vacuna o medicamento del historial, armamos la sugerencia para la app
  let sugerencia_registro = null;
  if (recordatorio.id_evento && recordatorio.tipo_recordatorio !== 'Tarea General') {
    const mascota = await Mascota.findOne(
      { _id: recordatorio.id_mascota, 'eventos_clinicos._id': recordatorio.id_evento },
      { 'eventos_clinicos.$': 1 } // trae solo ese registro del historial
    );
    const evento = mascota?.eventos_clinicos[0];
    if (evento) {
      sugerencia_registro = {
        id_mascota: recordatorio.id_mascota,
        tipo_registro: evento.tipo_registro,
        nombre: evento.nombre,
        fecha_evento: new Date().toISOString().slice(0, 10), // hoy, formato AAAA-MM-DD
      };
    }
  }

  res.json({ recordatorio, sugerencia_registro });
});

// PATCH /recordatorios/:id/posponer → reprograma el envío a una nueva fecha (HU17)
recordatoriosRouter.patch('/:id/posponer', async (req, res) => {
  const recordatorio = await buscarRecordatorio(req.params.id, res.locals.tutorId);
  if (!recordatorio) {
    res.status(404).json({ error: 'Recordatorio no encontrado' });
    return;
  }
  if (!ESTADOS_ABIERTOS.includes(recordatorio.estado ?? '')) {
    res.status(400).json({ error: `El recordatorio ya está ${recordatorio.estado}` });
    return;
  }

  const { nueva_fecha } = req.body ?? {};
  const nueva = new Date(nueva_fecha);
  if (typeof nueva_fecha !== 'string' || isNaN(nueva.getTime())) {
    res.status(400).json({ error: 'Debes indicar nueva_fecha (ejemplo: 2026-11-19 o 2026-11-19T09:00)' });
    return;
  }
  if (nueva <= new Date()) {
    res.status(400).json({ error: 'La nueva fecha debe ser futura' });
    return;
  }

  recordatorio.fecha_programada = nueva;
  recordatorio.estado = 'Pospuesto';
  await recordatorio.save();

  res.json(recordatorio);
});

// PATCH /recordatorios/:id/cancelar → cancela el recordatorio (HU17)
recordatoriosRouter.patch('/:id/cancelar', async (req, res) => {
  const recordatorio = await buscarRecordatorio(req.params.id, res.locals.tutorId);
  if (!recordatorio) {
    res.status(404).json({ error: 'Recordatorio no encontrado' });
    return;
  }
  if (!ESTADOS_ABIERTOS.includes(recordatorio.estado ?? '')) {
    res.status(400).json({ error: `El recordatorio ya está ${recordatorio.estado}` });
    return;
  }

  recordatorio.estado = 'Cancelado';
  await recordatorio.save();

  res.json(recordatorio);
});