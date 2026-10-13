import { Router } from 'express';
import mongoose, { isValidObjectId, Types } from 'mongoose';
import { Mascota, TIPOS_REGISTRO } from '../models/Mascota';
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

// Acepta un texto opcional (no enviado o string)
function textoOpcional(valor: unknown): boolean {
  return valor === undefined || typeof valor === 'string';
}

// POST /mascotas/:id/eventos → agrega un registro al historial clínico (HU07, HU08)
mascotasRouter.post('/:id/eventos', async (req, res) => {
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

  const {
    tipo_registro,
    nombre,
    fecha_evento,
    descripcion,
    dosis,
    veterinario,
    fecha_proxima_dosis,
    peso_kg,
  } = req.body ?? {};

  if (typeof tipo_registro !== 'string' || !TIPOS_REGISTRO.includes(tipo_registro)) {
    res.status(400).json({ error: `Tipo no válido. Opciones: ${TIPOS_REGISTRO.join(', ')}` });
    return;
  }
  const esPeso = tipo_registro === 'Peso';

  // Nombre obligatorio, salvo en Peso, donde por defecto se llama "Peso"
  let nombreFinal = typeof nombre === 'string' ? nombre.trim() : '';
  if (esPeso && nombreFinal === '') nombreFinal = 'Peso';
  if (nombreFinal === '') {
    res.status(400).json({ error: 'El nombre es obligatorio (por ejemplo: Antirrábica)' });
    return;
  }

  // HU07: la fecha no puede ser futura
  const fecha = new Date(fecha_evento);
  if (typeof fecha_evento !== 'string' || isNaN(fecha.getTime())) {
    res.status(400).json({ error: 'Fecha no válida (formato AAAA-MM-DD)' });
    return;
  }
  if (fecha > new Date()) {
    res.status(400).json({ error: 'La fecha no puede ser futura' });
    return;
  }

  // HU08: el peso solo se usa en registros de tipo Peso, y ahí es obligatorio
  if (esPeso) {
    if (typeof peso_kg !== 'number' || peso_kg <= 0 || peso_kg > 1000) {
      res.status(400).json({ error: 'Para un registro de Peso, peso_kg debe ser un número mayor a 0' });
      return;
    }
  } else if (peso_kg !== undefined) {
    res.status(400).json({ error: 'peso_kg solo se usa en registros de tipo Peso' });
    return;
  }

  if (!textoOpcional(descripcion) || !textoOpcional(dosis)) {
    res.status(400).json({ error: 'La descripción y la dosis deben ser texto' });
    return;
  }
  if (
    veterinario !== undefined &&
    (typeof veterinario !== 'object' ||
      veterinario === null ||
      !textoOpcional(veterinario.nombre) ||
      !textoOpcional(veterinario.clinica))
  ) {
    res.status(400).json({ error: 'Veterinario debe tener la forma { "nombre": "...", "clinica": "..." }' });
    return;
  }

  // Próxima dosis: opcional, posterior a la fecha, y no aplica a Peso
  let proxima: Date | null = null;
  if (fecha_proxima_dosis !== undefined && fecha_proxima_dosis !== null && fecha_proxima_dosis !== '') {
    if (esPeso) {
      res.status(400).json({ error: 'Un registro de Peso no tiene próxima dosis' });
      return;
    }
    proxima = new Date(fecha_proxima_dosis);
    if (typeof fecha_proxima_dosis !== 'string' || isNaN(proxima.getTime())) {
      res.status(400).json({ error: 'Fecha de próxima dosis no válida (formato AAAA-MM-DD)' });
      return;
    }
    if (proxima <= fecha) {
      res.status(400).json({ error: 'La próxima dosis debe ser posterior a la fecha del registro' });
      return;
    }
  }

  // HU08: si es el peso más reciente, actualiza el peso actual de la mascota
  if (esPeso) {
    const hayPesoMasNuevo = mascota.eventos_clinicos.some(
      (e) => e.tipo_registro === 'Peso' && e.fecha_evento > fecha
    );
    if (!hayPesoMasNuevo) {
      mascota.set('peso_actual', peso_kg);
    }
  }

  mascota.eventos_clinicos.push({
    tipo_registro,
    nombre: nombreFinal,
    fecha_evento: fecha,
    descripcion,
    dosis,
    veterinario,
    origen: 'Manual',
    fecha_proxima_dosis: proxima,
    peso_kg: esPeso ? peso_kg : undefined,
  });
  await mascota.save();

  const evento = mascota.eventos_clinicos[mascota.eventos_clinicos.length - 1];
  res.status(201).json(evento);
});

// GET /mascotas/:id/eventos → historial ordenado y filtrable (HU09)
// Ejemplos: /mascotas/ID/eventos  |  /mascotas/ID/eventos?tipo=Vacuna
mascotasRouter.get('/:id/eventos', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const { tipo } = req.query;
  if (tipo !== undefined && (typeof tipo !== 'string' || !TIPOS_REGISTRO.includes(tipo))) {
    res.status(400).json({ error: `Tipo no válido. Opciones: ${TIPOS_REGISTRO.join(', ')}` });
    return;
  }

  // Solo traemos el historial, no toda la ficha
  const mascota = await Mascota.findOne({ _id: id, id_tutor: res.locals.tutorId }).select(
    'eventos_clinicos'
  );
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const eventos = mascota
    .toObject()
    .eventos_clinicos.filter((e) => !tipo || e.tipo_registro === tipo)
    .sort((a, b) => {
      // Más reciente primero; si tienen la misma fecha, el último registrado primero
      const porFecha = b.fecha_evento.getTime() - a.fecha_evento.getTime();
      return porFecha !== 0 ? porFecha : b._id.toString().localeCompare(a._id.toString());
    });

  res.json({ total: eventos.length, eventos });
});

// GET /mascotas/:id/eventos/por-clinica → historial agrupado por clínica (HU33)
mascotasRouter.get('/:id/eventos/por-clinica', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const mascota = await Mascota.findOne({ _id: id, id_tutor: res.locals.tutorId }).select(
    'eventos_clinicos'
  );
  if (!mascota) {
    res.status(404).json({ error: 'Mascota no encontrada' });
    return;
  }

  const SIN_CLINICA = 'Sin clínica registrada';
  const lista = mascota.toObject().eventos_clinicos;
  type Evento = (typeof lista)[number];

  // Agrupa por nombre de clínica, sin distinguir mayúsculas ni espacios sobrantes
  const grupos = new Map<string, { clinica: string; eventos: Evento[] }>();
  for (const evento of lista) {
    const nombre = evento.veterinario?.clinica?.trim() || SIN_CLINICA;
    const clave = nombre.toLowerCase();
    if (!grupos.has(clave)) grupos.set(clave, { clinica: nombre, eventos: [] });
    grupos.get(clave)!.eventos.push(evento);
  }

  const resultado = [...grupos.values()]
    .map((grupo) => {
      grupo.eventos.sort((a, b) => b.fecha_evento.getTime() - a.fecha_evento.getTime());
      return {
        clinica: grupo.clinica,
        total: grupo.eventos.length,
        ultima_atencion: grupo.eventos[0].fecha_evento,
        eventos: grupo.eventos,
      };
    })
    // Clínicas con atención más reciente primero; "Sin clínica" siempre al final
    .sort((a, b) => {
      if (a.clinica === SIN_CLINICA) return 1;
      if (b.clinica === SIN_CLINICA) return -1;
      return b.ultima_atencion.getTime() - a.ultima_atencion.getTime();
    });

  res.json(resultado);
});