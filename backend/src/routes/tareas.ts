import { Router } from 'express';
import { enviarRecordatoriosPendientes } from '../services/recordatorios';

export const tareasRouter = Router();

// Solo la puede llamar quien conozca la clave (Cloud Scheduler).
// La clave va en la variable TAREAS_CLAVE (en .env y como secreto en Cloud Run).
tareasRouter.post('/recordatorios', async (req, res) => {
  const clave = process.env.TAREAS_CLAVE;
  if (!clave || req.get('X-Tarea-Clave') !== clave) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const enviados = await enviarRecordatoriosPendientes();
  res.json({ enviados });
});