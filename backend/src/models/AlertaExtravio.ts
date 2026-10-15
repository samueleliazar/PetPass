import { Schema, model } from 'mongoose';

const alertaSchema = new Schema(
  {
    id_mascota: { type: Schema.Types.ObjectId, ref: 'Mascota', required: true },
    mensaje: { type: String, required: true, trim: true },
    ultima_ubicacion: { type: String, trim: true },
    fecha_inicio: { type: Date, default: Date.now },
    fecha_actualizacion: { type: Date, default: null },
    fecha_cierre: { type: Date, default: null },
    estado: { type: String, enum: ['Activa', 'Cerrada'], default: 'Activa' },
  },
  { collection: 'Alerta_Extravio', versionKey: false }
);

// Para listar los extravíos de una mascota, del más reciente al más antiguo
alertaSchema.index({ id_mascota: 1, fecha_inicio: -1 });

// HU34: solo una alerta ACTIVA por mascota (la base de datos lo garantiza)
alertaSchema.index(
  { id_mascota: 1 },
  { unique: true, partialFilterExpression: { estado: 'Activa' } }
);

export const AlertaExtravio = model('AlertaExtravio', alertaSchema);