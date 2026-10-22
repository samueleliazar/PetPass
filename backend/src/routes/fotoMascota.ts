import { Router } from 'express';
import multer from 'multer';
import { isValidObjectId } from 'mongoose';
import { Mascota } from '../models/Mascota';
import { requiereAuth } from '../middleware/auth';
import { borrarArchivo, subirImagen, urlTemporal } from '../services/gcp';

export const fotoMascotaRouter = Router({ mergeParams: true });

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB (la app la achica antes)
  fileFilter: (_req, archivo, cb) => cb(null, ['image/jpeg', 'image/png'].includes(archivo.mimetype)),
});

function recibirImagen(req: any, res: any, next: any) {
  subida.single('imagen')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const mensaje =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'La foto no puede pesar más de 5 MB'
          : 'Envía una sola imagen JPG o PNG en el campo "imagen"';
      return res.status(400).json({ error: mensaje });
    }
    if (err) return next(err);
    next();
  });
}

// POST /mascotas/:id/foto (form-data, campo "imagen") → cambia la foto de perfil (HU05, HU21)
fotoMascotaRouter.post('/foto', requiereAuth, recibirImagen, async (req, res) => {
  const id = (req.params as { id: string }).id;
  if (!isValidObjectId(id)) return res.status(404).json({ error: 'Mascota no encontrada' });

  const mascota = await Mascota.findOne({ _id: id, id_tutor: res.locals.tutorId });
  if (!mascota) return res.status(404).json({ error: 'Mascota no encontrada' });
  if (!req.file) return res.status(400).json({ error: 'Envía una imagen JPG o PNG en el campo "imagen"' });

  try {
    const anterior = mascota.foto_perfil_url;
    const ruta = await subirImagen(req.file.buffer, req.file.mimetype, id);
    mascota.set('foto_perfil_url', ruta);
    await mascota.save();

    // La foto anterior ya no se usa: se borra del bucket (sin hacer esperar al usuario)
    if (anterior) borrarArchivo(anterior).catch((e) => console.error('No se pudo borrar la foto anterior:', e));

    res.json({ foto_temporal: await urlTemporal(ruta) });
  } catch (e) {
    console.error('Error al subir la foto de perfil:', e);
    res.status(502).json({ error: 'No se pudo subir la foto. Intenta de nuevo.' });
  }
});

// DELETE /mascotas/:id/foto → quita la foto de perfil
fotoMascotaRouter.delete('/foto', requiereAuth, async (req, res) => {
  const id = (req.params as { id: string }).id;
  if (!isValidObjectId(id)) return res.status(404).json({ error: 'Mascota no encontrada' });

  const mascota = await Mascota.findOne({ _id: id, id_tutor: res.locals.tutorId });
  if (!mascota) return res.status(404).json({ error: 'Mascota no encontrada' });

  const anterior = mascota.foto_perfil_url;
  mascota.set('foto_perfil_url', null);
  await mascota.save();
  if (anterior) await borrarArchivo(anterior);

  res.json({ foto_temporal: null });
});