import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { razasRouter } from './routes/razas'; // NUEVO
import { authRouter } from './routes/auth';
import { mascotasRouter } from './routes/mascotas';
import { recordatoriosRouter } from './routes/recordatorios';
import { extraviosRouter } from './routes/extravios';
import { medallasRouter } from './routes/medallas';
import { fichaPublicaRouter } from './routes/fichaPublica';
import { privacidadRouter } from './routes/privacidad';
const app = express();
const PORT = 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json()); // NUEVO: permite recibir datos en formato JSON

// Muestra en la terminal cada petición que llega (útil para depurar)
app.use((req, _res, next) => {
  console.log(`${new Date().toLocaleTimeString()} ${req.method} ${req.url}`);
  next();
});
app.use('/recordatorios', recordatoriosRouter);

app.get('/health', (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada';
  res.json({ estado: 'ok', db });
});

app.use('/razas', razasRouter); // NUEVO: todas las rutas de razas parten con /razas
app.use('/auth', authRouter);
app.use('/mascotas', mascotasRouter);
app.use('/mascotas/:id', extraviosRouter);
app.use('/mascotas/:id', medallasRouter);
app.use('/mascotas/:id', privacidadRouter);
app.use(fichaPublicaRouter);
async function iniciar() {
  if (!MONGODB_URI) {
    console.error('Falta MONGODB_URI en el archivo .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo conectar a MongoDB:', error);
    process.exit(1);
  }
}

iniciar();