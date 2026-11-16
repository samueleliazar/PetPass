import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Tutor } from '../models/Tutor';
import jwt from 'jsonwebtoken';
import { requiereAuth } from '../middleware/auth';
import { isValidObjectId } from 'mongoose';
import { enviarCorreo } from '../config/correo';

export const authRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_REGEX = /^\+?\d{8,15}$/;

// POST /auth/registro → crea una cuenta de tutor (HU01)
authRouter.post('/registro', async (req, res) => {
  const { nombre_completo, email, telefono, password } = req.body ?? {};

  if (typeof nombre_completo !== 'string' || nombre_completo.trim() === '') {
    res.status(400).json({ error: 'El nombre es obligatorio' });
    return;
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'El correo no es válido' });
    return;
  }
  if (typeof telefono !== 'string' || !TELEFONO_REGEX.test(telefono)) {
    res.status(400).json({ error: 'El teléfono no es válido (ejemplo: +56912345678)' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    return;
  }

  const existe = await Tutor.exists({ email: email.toLowerCase().trim() });
  if (existe) {
    res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const tutor = await Tutor.create({ nombre_completo, email, telefono, password_hash });

  res.status(201).json({
    id: tutor._id,
    nombre_completo: tutor.nombre_completo,
    email: tutor.email,
    telefono: tutor.telefono,
    fecha_registro: tutor.fecha_registro,
  });
});
// POST /auth/login → verifica credenciales y entrega un token (HU02)
authRouter.post('/login', async (req, res) => {
  const { email, password, token_push } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Debes ingresar correo y contraseña' });
    return;
  }

  // Pedimos explícitamente el hash, porque en el modelo está oculto
  const tutor = await Tutor.findOne({ email: email.toLowerCase().trim() }).select('+password_hash');
  const correcta = tutor ? await bcrypt.compare(password, tutor.password_hash) : false;

  if (!tutor || !correcta) {
    res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    return;
  }

  // HU02: al iniciar sesión se registra el token push del dispositivo (si viene)
  if (typeof token_push === 'string' && token_push !== '') {
    await Tutor.updateOne({ _id: tutor._id }, { $addToSet: { tokens_push: token_push } });
  }

  const token = jwt.sign({ id: tutor._id.toString() }, process.env.JWT_SECRET as string, {
    expiresIn: '7d',
  });

  res.json({
    token,
    tutor: { id: tutor._id, nombre_completo: tutor.nombre_completo, email: tutor.email },
  });
});

// GET /auth/perfil → datos del tutor que inició sesión (ruta privada)
authRouter.get('/perfil', requiereAuth, async (_req, res) => {
  const tutor = await Tutor.findById(res.locals.tutorId);
  if (!tutor) {
    res.status(404).json({ error: 'Tutor no encontrado' });
    return;
  }
  res.json(tutor);
});
// POST /auth/logout → quita el token push del dispositivo (HU02)
authRouter.post('/logout', requiereAuth, async (req, res) => {
  const { token_push } = req.body ?? {};

  if (typeof token_push === 'string' && token_push !== '') {
    await Tutor.updateOne({ _id: res.locals.tutorId }, { $pull: { tokens_push: token_push } });
  }

  res.json({ mensaje: 'Sesión cerrada' });
});

// PATCH /auth/perfil → edita teléfono y contacto alterno (HU04)
authRouter.patch('/perfil', requiereAuth, async (req, res) => {
  const { telefono, contacto_alterno } = req.body ?? {};
  const cambios: { telefono?: string; contacto_alterno?: string } = {};
  const borrar: { contacto_alterno?: '' } = {};

  if (telefono !== undefined) {
    if (typeof telefono !== 'string' || !TELEFONO_REGEX.test(telefono)) {
      res.status(400).json({ error: 'El teléfono no es válido (ejemplo: +56912345678)' });
      return;
    }
    cambios.telefono = telefono;
  }

  if (contacto_alterno !== undefined) {
    if (contacto_alterno === '' || contacto_alterno === null) {
      borrar.contacto_alterno = ''; // enviar vacío = quitar el contacto alterno
    } else if (typeof contacto_alterno !== 'string' || !TELEFONO_REGEX.test(contacto_alterno)) {
      res.status(400).json({ error: 'El contacto alterno no es válido (ejemplo: +56987654321)' });
      return;
    } else {
      cambios.contacto_alterno = contacto_alterno;
    }
  }

  const tutor = await Tutor.findByIdAndUpdate(
    res.locals.tutorId,
    { $set: cambios, $unset: borrar },
    { new: true }
  );

  if (!tutor) {
    res.status(404).json({ error: 'Tutor no encontrado' });
    return;
  }
  res.json(tutor);
});

const MENSAJE_RECUPERAR =
  'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña';
const ENLACE_INVALIDO = 'El enlace no es válido o ya expiró. Solicita uno nuevo.';

// POST /auth/recuperar → envía el enlace de recuperación al correo (HU03)
authRouter.post('/recuperar', async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'El correo no es válido' });
    return;
  }

  const tutor = await Tutor.findOne({ email: email.toLowerCase().trim() }).select('+password_hash');

  // Misma respuesta exista o no el correo: así nadie averigua quién está registrado
  if (!tutor) {
    res.json({ mensaje: MENSAJE_RECUPERAR });
    return;
  }

  // Firmado con la clave + el hash actual: al cambiar la contraseña, el enlace muere solo
  const token = jwt.sign(
    { id: tutor._id.toString(), tipo: 'reset' },
    (process.env.JWT_SECRET as string) + tutor.password_hash,
    { expiresIn: '30m' }
  );
  const base = process.env.APP_URL ?? process.env.PUBLIC_URL ?? 'http://localhost:3000';
  const enlace = `${base}/restablecer?token=${token}`;

  try {
    await enviarCorreo(
      tutor.email,
      'Recupera tu contraseña de PetPass',
      `<p>Hola ${tutor.nombre_completo}:</p>
       <p>Para crear una nueva contraseña, abre este enlace (vence en 30 minutos):</p>
       <p><a href="${enlace}">${enlace}</a></p>
       <p>Si no lo solicitaste, ignora este correo.</p>`
    );
  } catch (error) {
    console.error('Error al enviar correo de recuperación:', error);
    res.status(500).json({ error: 'No se pudo enviar el correo. Intenta más tarde.' });
    return;
  }

  res.json({ mensaje: MENSAJE_RECUPERAR });
});

// POST /auth/restablecer → cambia la contraseña usando el token del correo (HU03)
authRouter.post('/restablecer', async (req, res) => {
  const { token, password } = req.body ?? {};

  if (typeof token !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Debes enviar el token y la nueva contraseña' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    return;
  }

  // Primero leemos el token SIN verificarlo, solo para saber de qué tutor es
  const datos = jwt.decode(token) as { id?: string; tipo?: string } | null;
  if (!datos?.id || datos.tipo !== 'reset' || !isValidObjectId(datos.id)) {
    res.status(400).json({ error: ENLACE_INVALIDO });
    return;
  }

  const tutor = await Tutor.findById(datos.id).select('+password_hash');
  if (!tutor) {
    res.status(400).json({ error: ENLACE_INVALIDO });
    return;
  }

  // Ahora sí verificamos firma y expiración con la clave + el hash ACTUAL
  try {
    jwt.verify(token, (process.env.JWT_SECRET as string) + tutor.password_hash);
  } catch {
    res.status(400).json({ error: ENLACE_INVALIDO });
    return;
  }

  tutor.password_hash = await bcrypt.hash(password, 10);
  await tutor.save();

  res.json({ mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
});