import { Router } from 'express';
import { Recordatorio, ESTADOS_RECORDATORIO } from '../models/Recordatorio';
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