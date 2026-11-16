import 'dotenv/config';
import mongoose from 'mongoose';
import { Raza } from '../models/Raza';

const razasPorEspecie: Record<string, string[]> = {
  Perro: ['Labrador Retriever', 'Golden Retriever', 'Pastor Alemán', 'Poodle', 'Bulldog Francés',
    'Chihuahua', 'Beagle', 'Dachshund', 'Yorkshire Terrier', 'Shih Tzu', 'Border Collie',
    'Schnauzer', 'Pug', 'Boxer', 'Rottweiler'],
  Gato: ['Doméstico de pelo corto', 'Doméstico de pelo largo', 'Siamés', 'Persa', 'Maine Coon',
    'Bengalí', 'Ragdoll', 'Esfinge', 'British Shorthair', 'Angora Turco'],
  Conejo: ['Cabeza de León', 'Belier', 'Holandés', 'Rex', 'Enano Holandés'],
  Hamster: ['Sirio', 'Ruso', 'Roborovski', 'Chino'],
  Ave: ['Periquito', 'Cacatúa Ninfa', 'Agapornis', 'Canario', 'Loro'],
  Reptil: ['Tortuga', 'Iguana', 'Gecko Leopardo', 'Dragón Barbudo', 'Serpiente'],
  Otro: [],
};

async function cargarRazas() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  await Raza.init(); // crea el índice único

  let nuevas = 0;
  for (const [especie, razas] of Object.entries(razasPorEspecie)) {
    // Toda especie incluye Mestizo y Desconocida (HU38)
    for (const nombre of [...razas, 'Mestizo', 'Desconocida']) {
      const resultado = await Raza.updateOne(
        { especie, nombre },
        { $setOnInsert: { especie, nombre, activa: true } },
        { upsert: true }
      );
      if (resultado.upsertedCount > 0) nuevas++;
    }
  }

  console.log(`Listo: ${nuevas} razas nuevas agregadas`);
  await mongoose.disconnect();
}

cargarRazas().catch((error) => {
  console.error('Error al cargar razas:', error);
  process.exit(1);
});