import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Mascota } from '../models/Mascota';
import { requiereAuth } from '../middleware/auth';
import {
  esPlacaValida,
  generarTokenPublico,
  urlEmergencia,
} from '../services/placas';

export const medallasRouter = Router({ mergeParams: true });
medallasRouter.use(requiereAuth);

async function buscarMascotaDelTutor(id: string, tutorId: string) {
  if (!isValidObjectId(id)) return null;
  return Mascota.findOne({ _id: id, id_tutor: tutorId });
}

// POST /mascotas/:id/medalla → vincula una medalla a la mascota (HU18)
medallasRouter.post('/medalla', async (req, res) => {
  const mascota = await buscarMascotaDelTutor((req.params as { id: string }).id, res.locals.tutorId);
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const { uuid_placa, uid_nfc } = req.body ?? {};
  const codigo = typeof uuid_placa === 'string' ? uuid_placa.trim().toUpperCase() : '';

  // HU18: se verifica que el ID de la placa sea válido de PetPass
  if (!esPlacaValida(codigo)) {
    res.status(400).json({ error: 'Esta placa no es una medalla válida de PetPass' });
    return;
  }
  if (uid_nfc !== undefined && (typeof uid_nfc !== 'string' || uid_nfc.trim() === '')) {
    res.status(400).json({ error: 'El identificador NFC no es válido' });
    return;
  }

  if (mascota.medalla?.estado_vinculacion === 'Activa') {
    res.status(409).json({
      error: 'Esta mascota ya tiene una medalla activa. Desvincúlala o reemplázala primero.',
    });
    return;
  }

  // HU18: una placa no puede estar vinculada a más de una mascota
  const ocupada = await Mascota.exists({ 'medalla.uuid_placa': codigo, _id: { $ne: mascota._id } });
  if (ocupada) {
    res.status(409).json({ error: 'Esta medalla ya está vinculada a otra mascota' });
    return;
  }

  // HU18: al vincular se genera un token público aleatorio y la URL de emergencia
  const token = generarTokenPublico();
  mascota.set('medalla', {
    uuid_placa: codigo,
    uid_nfc: uid_nfc?.trim(),
    token_publico: token,
    estado_vinculacion: 'Activa',
    url_emergencia: urlEmergencia(token),
    fecha_vinculacion: new Date(),
  });

  try {
    await mascota.save();
  } catch (error) {
    // 11000 = otra petición vinculó la misma placa al mismo tiempo
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'Esta medalla ya está vinculada a otra mascota' });
      return;
    }
    throw error;
  }

  res.status(201).json(mascota.medalla);
});