import { Router } from 'express';
import { requiereAuth } from '../middleware/auth';
import { Tutor } from '../models/Tutor';

export const pushRouter = Router();

// Así se ven los tokens de Expo: ExponentPushToken[xxxxxxxx]
const FORMATO_TOKEN = /^Expo(nent)?PushToken\[.+\]$/;

// HU16/HU25: la app manda el token del teléfono al iniciar sesión
pushRouter.put('/token', requiereAuth, async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !FORMATO_TOKEN.test(token)) {
    res.status(400).json({ error: 'Token de push inválido' });
    return;
  }

  // Si el teléfono estaba asociado a OTRA cuenta (alguien cerró sesión y entró otro), se le quita
  await Tutor.updateMany(
    { _id: { $ne: res.locals.tutorId }, tokens_push: token },
    { $pull: { tokens_push: token } }
  );

  // $addToSet lo agrega solo si no estaba (no se duplica)
  await Tutor.updateOne({ _id: res.locals.tutorId }, { $addToSet: { tokens_push: token } });

  res.json({ ok: true });
});