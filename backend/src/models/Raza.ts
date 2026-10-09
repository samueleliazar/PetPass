import { Schema, model } from 'mongoose';

// Lista cerrada de especies (igual que en el modelo de datos)
export const ESPECIES = ['Perro', 'Gato', 'Conejo', 'Hamster', 'Ave', 'Reptil', 'Otro'];

const razaSchema = new Schema(
  {
    especie: { type: String, enum: ESPECIES, required: true },
    nombre: { type: String, required: true, trim: true },
    activa: { type: Boolean, default: true },
  },
  { collection: 'Raza' }
);

// No se repiten razas dentro de una misma especie
razaSchema.index({ especie: 1, nombre: 1 }, { unique: true });

export const Raza = model('Raza', razaSchema);