import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Mascota } from '../models/Mascota';
import { requiereAuth } from '../middleware/auth';

export const privacidadRouter = Router({ mergeParams: true });

const CAMPOS = ['telefono', 'alergias', 'tratamientos', 'vacunas'] as const;
type Campo = (typeof CAMPOS)[number];

// Los mismos valores por defecto del modelo (para mascotas antiguas sin privacidad guardada)
const POR_DEFECTO: Record<Campo, boolean> = {
  telefono: true,
  alergias: true,
  tratamientos: false,
  vacunas: false,
};

// GET /mascotas/:id/privacidad → qué se muestra en la ficha pública
privacidadRouter.get('/privacidad', requiereAuth, async (req, res) => {
  const id = (req.params as { id: string }).id;
  if (!isValidObjectId(id)) return res.status(404).json({ error: 'Mascota no encontrada' });

  const mascota = await Mascota.findOne({ _id: id, id_tutor: res.locals.tutorId })
    .select('visibilidad_publica')
    .lean();
  if (!mascota) return res.status(404).json({ error: 'Mascota no encontrada' });

  res.json({ ...POR_DEFECTO, ...(mascota.visibilidad_publica ?? {}) });
});

// PATCH /mascotas/:id/privacidad → cambia uno o varios interruptores (HU23)
privacidadRouter.patch('/privacidad', requiereAuth, async (req, res) => {
  const id = (req.params as { id: string }).id;
  if (!isValidObjectId(id)) return res.status(404).json({ error: 'Mascota no encontrada' });

  const cambios: Record<string, boolean> = {};
  for (const campo of CAMPOS) {
    const valor = req.body?.[campo];
    if (valor === undefined) continue;
    if (typeof valor !== 'boolean') {
      return res.status(400).json({ error: `"${campo}" debe ser true o false` });
    }
    cambios[`visibilidad_publica.${campo}`] = valor;
  }
  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'Envía al menos uno: telefono, alergias, tratamientos o vacunas' });
  }

  // Solo el dueño puede cambiarla (id_tutor en el filtro)
  const mascota = await Mascota.findOneAndUpdate(
    { _id: id, id_tutor: res.locals.tutorId },
    { $set: cambios },
    { new: true }
  )
    .select('visibilidad_publica')
    .lean();
  if (!mascota) return res.status(404).json({ error: 'Mascota no encontrada' });

  res.json({ ...POR_DEFECTO, ...(mascota.visibilidad_publica ?? {}) });
});