import { Router } from 'express';
import mongoose, { isValidObjectId, Types } from 'mongoose';
import { Mascota, TIPOS_REGISTRO } from '../models/Mascota';
import { Raza, ESPECIES } from '../models/Raza';
import { requiereAuth } from '../middleware/auth';
import { sincronizarRecordatorioDeEvento, eliminarRecordatorioDeEvento } from '../services/recordatorios';
import { validarNuevoEvento } from '../services/eventos';
import { Documento } from '../models/Documento';
import { Recordatorio } from '../models/Recordatorio';
import { AlertaExtravio } from '../models/AlertaExtravio';
import { LecturaEmergencia } from '../models/LecturaEmergencia';
import { borrarImagenesDeMascota, fotoTemporal } from '../services/gcp';

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

  res.json(
    await Promise.all(
      mascotas.map(async (m) => ({ ...m.toJSON(), foto_temporal: await fotoTemporal(m.foto_perfil_url) }))
    )
  );
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
    res.json({ ...mascota.toJSON(), foto_temporal: await fotoTemporal(mascota.foto_perfil_url) });
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

  // Datos guardados en otras colecciones. Se usan los modelos (no los nombres de colección),
  // porque Mongoose guarda las colecciones en minúscula y plural (ej: "documentos").
  await Promise.all([
    Documento.deleteMany({ id_mascota: mascota._id }),
    Recordatorio.deleteMany({ id_mascota: mascota._id }),
    AlertaExtravio.deleteMany({ id_mascota: mascota._id }),
    LecturaEmergencia.deleteMany({ id_mascota: mascota._id }),
    borrarImagenesDeMascota(mascota._id.toString()), // fotos de los carnets en Cloud Storage
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

  const resultado = validarNuevoEvento(req.body);
  if ('error' in resultado) {
    res.status(400).json({ error: resultado.error });
    return;
  }
  const datos = resultado.datos;

  // HU08: si es el peso más reciente, actualiza el peso actual de la mascota
  if (datos.tipo_registro === 'Peso') {
    const hayPesoMasNuevo = mascota.eventos_clinicos.some(
      (e) => e.tipo_registro === 'Peso' && e.fecha_evento > datos.fecha_evento
    );
    if (!hayPesoMasNuevo) mascota.set('peso_actual', datos.peso_kg);
  }

  mascota.eventos_clinicos.push({ ...datos, origen: 'Manual' });
  await mascota.save();

  const evento = mascota.eventos_clinicos[mascota.eventos_clinicos.length - 1];
  await sincronizarRecordatorioDeEvento(mascota, evento);
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

// ---------- Edición y borrado de registros del historial ----------

type MascotaDoc = NonNullable<Awaited<ReturnType<typeof Mascota.findOne>>>;

// Busca la mascota del tutor y, dentro de ella, el registro del historial
async function obtenerMascotaYEvento(idMascota: string, idEvento: string, tutorId: string) {
  if (!isValidObjectId(idMascota) || !isValidObjectId(idEvento)) return null;

  const mascota = await Mascota.findOne({ _id: idMascota, id_tutor: tutorId });
  if (!mascota) return null;

  const evento = mascota.eventos_clinicos.id(idEvento);
  if (!evento) return null;

  return { mascota, evento };
}

// Deja en peso_actual el peso más reciente del historial (si hay alguno)
function recalcularPesoActual(mascota: MascotaDoc) {
  const pesos = mascota.eventos_clinicos.filter(
    (e) => e.tipo_registro === 'Peso' && e.peso_kg != null
  );
  if (pesos.length === 0) return; // sin pesos en el historial: se mantiene el valor actual
  const masReciente = pesos.reduce((a, b) => (b.fecha_evento > a.fecha_evento ? b : a));
  mascota.set('peso_actual', masReciente.peso_kg);
}

// PATCH /mascotas/:id/eventos/:eventoId → edita un registro del historial
mascotasRouter.patch('/:id/eventos/:eventoId', async (req, res) => {
  const encontrado = await obtenerMascotaYEvento(
    req.params.id,
    req.params.eventoId,
    res.locals.tutorId
  );
  if (!encontrado) {
    res.status(404).json({ error: 'Registro no encontrado' });
    return;
  }
  const { mascota, evento } = encontrado;

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

  if (
    [tipo_registro, nombre, fecha_evento, descripcion, dosis, veterinario, fecha_proxima_dosis, peso_kg].every(
      (v) => v === undefined
    )
  ) {
    res.status(400).json({ error: 'No enviaste cambios' });
    return;
  }

  // Regla 1: el tipo no se cambia
  if (tipo_registro !== undefined && tipo_registro !== evento.tipo_registro) {
    res.status(400).json({
      error: 'No se puede cambiar el tipo de registro. Elimínalo y crea uno nuevo.',
    });
    return;
  }
  const esPeso = evento.tipo_registro === 'Peso';

  if (nombre !== undefined) {
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      res.status(400).json({ error: 'El nombre no puede quedar vacío' });
      return;
    }
    evento.nombre = nombre.trim();
  }

  if (fecha_evento !== undefined) {
    const fecha = new Date(fecha_evento);
    if (typeof fecha_evento !== 'string' || isNaN(fecha.getTime())) {
      res.status(400).json({ error: 'Fecha no válida (formato AAAA-MM-DD)' });
      return;
    }
    if (fecha > new Date()) {
      res.status(400).json({ error: 'La fecha no puede ser futura' });
      return;
    }
    evento.fecha_evento = fecha;
  }

  if (!textoOpcional(descripcion) || !textoOpcional(dosis)) {
    res.status(400).json({ error: 'La descripción y la dosis deben ser texto' });
    return;
  }
  if (descripcion !== undefined) evento.descripcion = descripcion;
  if (dosis !== undefined) evento.dosis = dosis;

  if (veterinario !== undefined) {
    if (
      typeof veterinario !== 'object' ||
      veterinario === null ||
      !textoOpcional(veterinario.nombre) ||
      !textoOpcional(veterinario.clinica)
    ) {
      res.status(400).json({ error: 'Veterinario debe tener la forma { "nombre": "...", "clinica": "..." }' });
      return;
    }
    evento.set('veterinario', veterinario);
  }

  if (peso_kg !== undefined) {
    if (!esPeso) {
      res.status(400).json({ error: 'peso_kg solo se usa en registros de tipo Peso' });
      return;
    }
    if (typeof peso_kg !== 'number' || peso_kg <= 0 || peso_kg > 1000) {
      res.status(400).json({ error: 'peso_kg debe ser un número mayor a 0' });
      return;
    }
    evento.peso_kg = peso_kg;
  }

  if (fecha_proxima_dosis !== undefined) {
    if (fecha_proxima_dosis === null || fecha_proxima_dosis === '') {
      evento.fecha_proxima_dosis = null; // enviar null o "" = quitar la próxima dosis
    } else {
      if (esPeso) {
        res.status(400).json({ error: 'Un registro de Peso no tiene próxima dosis' });
        return;
      }
      const proxima = new Date(fecha_proxima_dosis);
      if (typeof fecha_proxima_dosis !== 'string' || isNaN(proxima.getTime())) {
        res.status(400).json({ error: 'Fecha de próxima dosis no válida (formato AAAA-MM-DD)' });
        return;
      }
      evento.fecha_proxima_dosis = proxima;
    }
  }

  // Revisión final: con los valores ya combinados (los nuevos y los que no cambiaron)
  if (evento.fecha_proxima_dosis && evento.fecha_proxima_dosis <= evento.fecha_evento) {
    res.status(400).json({ error: 'La próxima dosis debe ser posterior a la fecha del registro' });
    return;
  }

  // Regla 2: si es un peso, recalcular el peso actual
  if (esPeso) recalcularPesoActual(mascota);

  await mascota.save();
  await sincronizarRecordatorioDeEvento(mascota, evento);
  res.json(evento);
});

// DELETE /mascotas/:id/eventos/:eventoId → borra un registro del historial
mascotasRouter.delete('/:id/eventos/:eventoId', async (req, res) => {
  const encontrado = await obtenerMascotaYEvento(
    req.params.id,
    req.params.eventoId,
    res.locals.tutorId
  );
  if (!encontrado) {
    res.status(404).json({ error: 'Registro no encontrado' });
    return;
  }
  const { mascota, evento } = encontrado;
  const eraPeso = evento.tipo_registro === 'Peso';

  mascota.eventos_clinicos.pull(evento._id);
  if (eraPeso) recalcularPesoActual(mascota);
  await mascota.save();

  await eliminarRecordatorioDeEvento(evento._id);

  res.json({ mensaje: 'Registro eliminado del historial' });
});