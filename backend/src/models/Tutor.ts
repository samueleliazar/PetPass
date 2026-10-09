import { Schema, model } from 'mongoose';

const tutorSchema = new Schema(
  {
    nombre_completo: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    telefono: { type: String, required: true, trim: true },
    contacto_alterno: { type: String, trim: true },
    password_hash: { type: String, required: true, select: false },
    tokens_push: { type: [String], default: [] },
    fecha_registro: { type: Date, default: Date.now },
  },
  { collection: 'Tutor', versionKey: false }
);

export const Tutor = model('Tutor', tutorSchema);