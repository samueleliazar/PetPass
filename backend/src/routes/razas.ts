import { Router } from 'express';
import { Raza, ESPECIES } from '../models/Raza';

export const razasRouter = Router();

// GET /razas/especies → lista de especies (para el primer selector de la app)
razasRouter.get('/especies', (_req, res) => {
  res.json(ESPECIES);
});

// GET /razas?especie=Perro → razas activas de esa especie
razasRouter.get('/', async (req, res) => {
  const especie = req.query.especie;

  if (typeof especie !== 'string' || !ESPECIES.includes(especie)) {
    res.status(400).json({
      error: `Debes indicar una especie válida: ${ESPECIES.join(', ')}`,
    });
    return;
  }

  const razas = await Raza.find({ especie, activa: true })
    .select('nombre')
    .sort({ nombre: 1 });

  res.json(razas);
});