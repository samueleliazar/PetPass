import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { razasRouter } from './routes/razas'; // NUEVO

const app = express();
const PORT = 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json()); // NUEVO: permite recibir datos en formato JSON

app.get('/health', (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada';
  res.json({ estado: 'ok', db });
});

app.use('/razas', razasRouter); // NUEVO: todas las rutas de razas parten con /razas

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