import { Router } from 'express';
import multer from 'multer';
import { isValidObjectId } from 'mongoose';
import { Mascota } from '../models/Mascota';
import { Documento } from '../models/Documento';
import { requiereAuth } from '../middleware/auth';
import { leerTexto, subirImagen, urlTemporal } from '../services/gcp';

export const documentosRouter = Router({ mergeParams: true });

// HU10: solo JPG o PNG, máximo 10 MB. Se guarda en memoria (no en el disco del servidor).
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, archivo, cb) => cb(null, ['image/jpeg', 'image/png'].includes(archivo.mimetype)),
});

async function mascotaPropia(id: string, tutorId: string) {
  if (!isValidObjectId(id)) return false;
  return Boolean(await Mascota.exists({ _id: id, id_tutor: tutorId }));
}

// POST /mascotas/:id/documentos (form-data, campo "imagen") → sube, lee y deja Pendiente (HU10, HU11, HU13)
documentosRouter.post('/documentos', requiereAuth, (req, res, next) => {
  subida.single('imagen')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const mensaje =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'La imagen no puede pesar más de 10 MB'
          : 'Envía una sola imagen JPG o PNG en el campo "imagen"';
      return res.status(400).json({ error: mensaje });
    }
    if (err) return next(err);
    next();
  });
}, async (req, res) => {
  const id = (req.params as { id: string }).id;
  if (!(await mascotaPropia(id, res.locals.tutorId))) {
    return res.status(404).json({ error: 'Mascota no encontrada' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Envía una imagen JPG o PNG en el campo "imagen"' });
  }

  try {
    // Subir la foto y leer el texto AL MISMO TIEMPO, para responder más rápido
    const [ruta, ocr] = await Promise.all([
      subirImagen(req.file.buffer, req.file.mimetype, id),
      leerTexto(req.file.buffer),
    ]);

    const documento = await Documento.create({
      id_mascota: id,
      imagen_url: ruta,
      texto_ocr_raw: ocr.texto,
      confianza_ocr: ocr.confianza,
      estado: 'Pendiente', // HU11: queda Pendiente hasta que el tutor lo valide
    });

    res.status(201).json({ ...documento.toJSON(), imagen_temporal: await urlTemporal(ruta) });
  } catch (e) {
    console.error('Error al procesar el documento:', e);
    res.status(502).json({ error: 'No se pudo procesar la imagen. Intenta de nuevo.' });
  }
});

// GET /mascotas/:id/documentos → lista de carnets subidos (sin el texto, para que sea liviana)
documentosRouter.get('/documentos', requiereAuth, async (req, res) => {
  const id = (req.params as { id: string }).id;
  if (!(await mascotaPropia(id, res.locals.tutorId))) {
    return res.status(404).json({ error: 'Mascota no encontrada' });
  }
  const documentos = await Documento.find({ id_mascota: id })
    .sort({ fecha_carga: -1 })
    .select('-texto_ocr_raw -texto_validado');
  res.json(documentos);
});

// GET /mascotas/:id/documentos/:docId → detalle, con enlace temporal a la foto (HU13)
documentosRouter.get('/documentos/:docId', requiereAuth, async (req, res) => {
  const { id, docId } = req.params as { id: string; docId: string };
  if (!(await mascotaPropia(id, res.locals.tutorId)) || !isValidObjectId(docId)) {
    return res.status(404).json({ error: 'Documento no encontrado' });
  }
  const documento = await Documento.findOne({ _id: docId, id_mascota: id });
  if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });

  res.json({ ...documento.toJSON(), imagen_temporal: await urlTemporal(documento.imagen_url) });
});

// PATCH /mascotas/:id/documentos/:docId/validar { texto_validado } → Validado (HU12)
documentosRouter.patch('/documentos/:docId/validar', requiereAuth, async (req, res) => {
  const { id, docId } = req.params as { id: string; docId: string };
  if (!(await mascotaPropia(id, res.locals.tutorId)) || !isValidObjectId(docId)) {
    return res.status(404).json({ error: 'Documento no encontrado' });
  }

  const texto = req.body?.texto_validado;
  if (typeof texto !== 'string' || texto.trim() === '') {
    return res.status(400).json({ error: 'Envía el texto corregido en "texto_validado"' });
  }
  if (texto.length > 20000) {
    return res.status(400).json({ error: 'El texto es demasiado largo' });
  }

  const documento = await Documento.findOne({ _id: docId, id_mascota: id });
  if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });
  if (documento.estado === 'Validado') {
    return res.status(409).json({ error: 'Este documento ya fue validado' });
  }

  // HU12: se guarda el texto corregido. Todavía NO se crea nada en el historial (eso es HU14).
  documento.texto_validado = texto.trim();
  documento.estado = 'Validado';
  await documento.save();
  res.json(documento.toJSON());
});