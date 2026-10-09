import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Tutor } from '../models/Tutor';

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