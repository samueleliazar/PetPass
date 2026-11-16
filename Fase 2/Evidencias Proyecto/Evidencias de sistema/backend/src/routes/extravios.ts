import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Mascota } from '../models/Mascota';
import { AlertaExtravio } from '../models/AlertaExtravio';
import { requiereAuth } from '../middleware/auth';

// mergeParams: permite leer el :id de la mascota que viene en la dirección
export const extraviosRouter = Router({ mergeParams: true });
extraviosRouter.use(requiereAuth);

const LARGO_MAXIMO = 500;

async function buscarMascotaDelTutor(id: string, tutorId: string) {
  if (!isValidObjectId(id)) return null;
  return Mascota.findOne({ _id: id, id_tutor: tutorId });
}

// POST /mascotas/:id/extravio → reporta la mascota como extraviada (HU34)
extraviosRouter.post('/extravio', async (req, res) => {
  const mascota = await buscarMascotaDelTutor((req.params as { id: string }).id, res.locals.tutorId);
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const { mensaje, ultima_ubicacion } = req.body ?? {};
  if (typeof mensaje !== 'string' || mensaje.trim() === '') {
    res.status(400).json({ error: 'El mensaje es obligatorio: indica cómo ayudar a quien la encuentre' });
    return;
  }
  if (mensaje.length > LARGO_MAXIMO) {
    res.status(400).json({ error: `El mensaje no puede superar ${LARGO_MAXIMO} caracteres` });
    return;
  }
  if (ultima_ubicacion !== undefined && typeof ultima_ubicacion !== 'string') {
    res.status(400).json({ error: 'La última ubicación debe ser texto' });
    return;
  }

  if (mascota.estado_extraviado) {
    res.status(409).json({
      error: 'Esta mascota ya tiene un reporte de extravío activo. Edítalo o márcala como encontrada.',
    });
    return;
  }

  // HU34: siempre una alerta NUEVA, con el mensaje de este episodio
  let alerta;
  try {
    alerta = await AlertaExtravio.create({
      id_mascota: mascota._id,
      mensaje: mensaje.trim(),
      ultima_ubicacion: ultima_ubicacion?.trim() || undefined,
    });
  } catch (error) {
    // 11000 = la base de datos rechazó una segunda alerta activa
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'Esta mascota ya tiene un reporte de extravío activo.' });
      return;
    }
    throw error;
  }

  mascota.set({ estado_extraviado: true, id_alerta_activa: alerta._id });
  await mascota.save();

  res.status(201).json(alerta);
});

// PATCH /mascotas/:id/extravio → edita el mensaje o la ubicación de la alerta activa (HU34)
extraviosRouter.patch('/extravio', async (req, res) => {
  const mascota = await buscarMascotaDelTutor((req.params as { id: string }).id, res.locals.tutorId);
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const alerta = await AlertaExtravio.findOne({ _id: mascota.id_alerta_activa, estado: 'Activa' });
  if (!alerta) {
    res.status(404).json({ error: 'La mascota no tiene un reporte de extravío activo' });
    return;
  }

  const { mensaje, ultima_ubicacion } = req.body ?? {};
  if (mensaje === undefined && ultima_ubicacion === undefined) {
    res.status(400).json({ error: 'No enviaste cambios: indica mensaje o ultima_ubicacion' });
    return;
  }

  if (mensaje !== undefined) {
    if (typeof mensaje !== 'string' || mensaje.trim() === '') {
      res.status(400).json({ error: 'El mensaje no puede quedar vacío' });
      return;
    }
    if (mensaje.length > LARGO_MAXIMO) {
      res.status(400).json({ error: `El mensaje no puede superar ${LARGO_MAXIMO} caracteres` });
      return;
    }
    alerta.mensaje = mensaje.trim();
  }

  if (ultima_ubicacion !== undefined) {
    if (typeof ultima_ubicacion !== 'string') {
      res.status(400).json({ error: 'La última ubicación debe ser texto' });
      return;
    }
    alerta.ultima_ubicacion = ultima_ubicacion.trim() || undefined; // "" = quitarla
  }

  alerta.fecha_actualizacion = new Date(); // HU34: queda registrada la fecha de actualización
  await alerta.save();

  res.json(alerta);
});

// POST /mascotas/:id/extravio/encontrada → cierra la alerta activa (HU35)
extraviosRouter.post('/extravio/encontrada', async (req, res) => {
  const mascota = await buscarMascotaDelTutor((req.params as { id: string }).id, res.locals.tutorId);
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const alerta = await AlertaExtravio.findOne({ _id: mascota.id_alerta_activa, estado: 'Activa' });
  if (!alerta) {
    res.status(404).json({ error: 'La mascota no tiene un reporte de extravío activo' });
    return;
  }

  alerta.estado = 'Cerrada';
  alerta.fecha_cierre = new Date();
  await alerta.save();

  mascota.set({ estado_extraviado: false, id_alerta_activa: null });
  await mascota.save();

  res.json({ mensaje: `¡Qué bueno que ${mascota.nombre} volvió a casa!`, alerta });
});

// GET /mascotas/:id/extravios → historial de extravíos de la mascota
extraviosRouter.get('/extravios', async (req, res) => {
  const mascota = await buscarMascotaDelTutor((req.params as { id: string }).id, res.locals.tutorId);
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const alertas = await AlertaExtravio.find({ id_mascota: mascota._id }).sort({ fecha_inicio: -1 });
  res.json(alertas);
});