import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Revisa que la petición traiga un token válido.
// Si es válido, guarda el id del tutor en res.locals.tutorId
export function requiereAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Debes iniciar sesión' });
    return;
  }

  try {
    const token = header.slice(7); // quita la palabra "Bearer "
    const datos = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    res.locals.tutorId = datos.id;
    next(); // todo bien: deja pasar a la ruta
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}