import { Router } from 'express';
import mongoose, { isValidObjectId, Types } from 'mongoose';
import { Mascota } from '../models/Mascota';
import { Raza, ESPECIES } from '../models/Raza';
import { requiereAuth } from '../middleware/auth';

export const mascotasRouter = Router();

// Todas las rutas de mascotas requieren sesión iniciada
mascotasRouter.use(requiereAuth);

// POST /mascotas → crea una mascota del tutor (HU05)
mascotasRouter.post('/', async (req, res) => {
  const { nombre, especie, id_raza, fecha_nacimiento, peso_actual } = req.body ?? {};

  if (typeof nombre !== 'string' || nombre.trim() === '') {
    res.status(400).json({ error: 'El nombre es obligatorio' });
    return;
  }
  if (typeof especie !== 'string' || !ESPECIES.includes(especie)) {
    res.status(400).json({ error: `Especie no válida. Opciones: ${ESPECIES.join(', ')}` });
    return;
  }
  if (typeof id_raza !== 'string' || !isValidObjectId(id_raza)) {
    res.status(400).json({ error: 'Debes elegir una raza del catálogo' });
    return;
  }

  // La raza debe existir, estar activa y corresponder a la especie elegida
  const razaValida = await Raza.exists({ _id: id_raza, especie, activa: true });
  if (!razaValida) {
    res.status(400).json({ error: 'La raza no corresponde a la especie elegida' });
    return;
  }

  if (typeof fecha_nacimiento !== 'string' || isNaN(new Date(fecha_nacimiento).getTime())) {
    res.status(400).json({ error: 'Fecha de nacimiento no válida (formato AAAA-MM-DD)' });
    return;
  }
  const nacimiento = new Date(fecha_nacimiento);
  if (nacimiento > new Date()) {
    res.status(400).json({ error: 'La fecha de nacimiento no puede ser futura' });
    return;
  }

  if (peso_actual !== undefined && (typeof peso_actual !== 'number' || peso_actual <= 0)) {
    res.status(400).json({ error: 'El peso debe ser un número mayor a 0' });
    return;
  }

  const mascota = await Mascota.create({
    id_tutor: res.locals.tutorId, // el dueño es quien inició sesión
    nombre,
    especie,
    id_raza,
    fecha_nacimiento: nacimiento,
    peso_actual,
  });

  res.status(201).json(mascota);
});

// GET /mascotas → lista las mascotas del tutor
mascotasRouter.get('/', async (_req, res) => {
  const mascotas = await Mascota.find({ id_tutor: res.locals.tutorId })
    .populate('id_raza', 'nombre')
    .sort({ nombre: 1 });

  res.json(mascotas);
});
// Revisa que sea una lista de textos y la limpia (sin vacíos ni repetidos)
function limpiarLista(valor: unknown): string[] | null {
  if (!Array.isArray(valor) || !valor.every((x) => typeof x === 'string')) return null;
  const limpios = valor.map((x: string) => x.trim()).filter((x) => x !== '');
  return [...new Set(limpios)];
}

// GET /mascotas/:id → ficha de una mascota del tutor
mascotasRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const mascota = await Mascota.findOne({ _id: id, id_tutor: res.locals.tutorId }).populate(
    'id_raza',
    'nombre'
  );
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }
  res.json(mascota);
});

// PATCH /mascotas/:id → edita la mascota (HU06) y sus alergias/condiciones (HU08)
mascotasRouter.patch('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const mascota = await Mascota.findOne({ _id: id, id_tutor: res.locals.tutorId });
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const { nombre, especie, id_raza, fecha_nacimiento, alergias, condiciones_criticas } =
    req.body ?? {};

  if ([nombre, especie, id_raza, fecha_nacimiento, alergias, condiciones_criticas].every((v) => v === undefined)) {
    res.status(400).json({ error: 'No enviaste cambios' });
    return;
  }

  if (nombre !== undefined) {
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      res.status(400).json({ error: 'El nombre no puede quedar vacío' });
      return;
    }
    mascota.nombre = nombre.trim();
  }

  if (especie !== undefined) {
    if (typeof especie !== 'string' || !ESPECIES.includes(especie)) {
      res.status(400).json({ error: `Especie no válida. Opciones: ${ESPECIES.join(', ')}` });
      return;
    }
    // HU06: si cambia la especie, se debe volver a elegir la raza
    if (especie !== mascota.especie && id_raza === undefined) {
      res.status(400).json({ error: 'Si cambias la especie debes elegir una raza nueva' });
      return;
    }
    mascota.especie = especie;
  }

  if (id_raza !== undefined) {
    if (typeof id_raza !== 'string' || !isValidObjectId(id_raza)) {
      res.status(400).json({ error: 'Debes elegir una raza del catálogo' });
      return;
    }
    const razaValida = await Raza.exists({ _id: id_raza, especie: mascota.especie, activa: true });
    if (!razaValida) {
      res.status(400).json({ error: 'La raza no corresponde a la especie de la mascota' });
      return;
    }
    mascota.set('id_raza', new Types.ObjectId(id_raza));
  }

  if (fecha_nacimiento !== undefined) {
    const nacimiento = new Date(fecha_nacimiento);
    if (typeof fecha_nacimiento !== 'string' || isNaN(nacimiento.getTime())) {
      res.status(400).json({ error: 'Fecha de nacimiento no válida (formato AAAA-MM-DD)' });
      return;
    }
    if (nacimiento > new Date()) {
      res.status(400).json({ error: 'La fecha de nacimiento no puede ser futura' });
      return;
    }
    mascota.fecha_nacimiento = nacimiento;
  }

  if (alergias !== undefined) {
    const lista = limpiarLista(alergias);
    if (!lista) {
      res.status(400).json({ error: 'Las alergias deben ser una lista de textos' });
      return;
    }
    mascota.set('alergias', lista);
  }

  if (condiciones_criticas !== undefined) {
    const lista = limpiarLista(condiciones_criticas);
    if (!lista) {
      res.status(400).json({ error: 'Las condiciones críticas deben ser una lista de textos' });
      return;
    }
    mascota.set('condiciones_criticas', lista);
  }

  await mascota.save();
  await mascota.populate('id_raza', 'nombre');
  res.json(mascota);
});

// DELETE /mascotas/:id → elimina la mascota y todo lo asociado (HU06)
mascotasRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const mascota = await Mascota.findOne({ _id: id, id_tutor: res.locals.tutorId });
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  // Colecciones que guardan datos de la mascota por referencia (id_mascota).
  // Algunas todavía no existen; borrar en una colección vacía no da error.
  const db = mongoose.connection;
  await Promise.all([
    db.collection('Documento').deleteMany({ id_mascota: mascota._id }),
    db.collection('Recordatorio').deleteMany({ id_mascota: mascota._id }),
    db.collection('Alerta_Extravio').deleteMany({ id_mascota: mascota._id }),
    db.collection('Lectura_Emergencia').deleteMany({ id_mascota: mascota._id }),
  ]);

  // El historial clínico y la medalla están DENTRO de la mascota: se borran con ella
  await mascota.deleteOne();

  res.json({ mensaje: `${mascota.nombre} y toda su información fueron eliminados` });
});