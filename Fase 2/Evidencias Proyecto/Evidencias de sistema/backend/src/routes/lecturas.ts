import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Mascota } from '../models/Mascota';
import { LecturaEmergencia } from '../models/LecturaEmergencia';
import { requiereAuth } from '../middleware/auth';

export const lecturasRouter = Router({ mergeParams: true });

// GET /mascotas/:id/lecturas?alerta=ID → últimos escaneos (base para HU36)
lecturasRouter.get('/lecturas', requiereAuth, async (req, res) => {
  const id = (req.params as { id: string }).id;
  if (!isValidObjectId(id)) return res.status(404).json({ error: 'Mascota no encontrada' });

  const esMia = await Mascota.exists({ _id: id, id_tutor: res.locals.tutorId });
  if (!esMia) return res.status(404).json({ error: 'Mascota no encontrada' });

  const filtro: Record<string, unknown> = { id_mascota: id };
  const alerta = req.query.alerta;
  if (typeof alerta === 'string') {
    if (!isValidObjectId(alerta)) return res.status(400).json({ error: 'Alerta no válida' });
    filtro.id_alerta = alerta;
  }

  const lecturas = await LecturaEmergencia.find(filtro)
    .sort({ fecha_hora: -1 })
    .limit(100)
    .select('-user_agent') // dato técnico: no hace falta en la app
    .lean();
  res.json(lecturas);
});