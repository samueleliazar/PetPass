import { Schema, model } from 'mongoose';
import { ESPECIES } from './Raza';

const mascotaSchema = new Schema(
  {
    id_tutor: { type: Schema.Types.ObjectId, ref: 'Tutor', required: true, index: true },
    nombre: { type: String, required: true, trim: true },
    especie: { type: String, enum: ESPECIES, required: true },
    id_raza: { type: Schema.Types.ObjectId, ref: 'Raza', required: true },
    fecha_nacimiento: { type: Date, required: true },
    peso_actual: {
      type: Schema.Types.Decimal128,
      get: (v: any) => (v == null ? v : parseFloat(v.toString())),
    },
    foto_perfil_url: { type: String },
    alergias: { type: [String], default: [] },
    condiciones_criticas: { type: [String], default: [] },
    visibilidad_publica: {
      telefono: { type: Boolean, default: true },
      alergias: { type: Boolean, default: true },
      tratamientos: { type: Boolean, default: false },
      vacunas: { type: Boolean, default: false },
    },
    estado_extraviado: { type: Boolean, default: false },
    id_alerta_activa: { type: Schema.Types.ObjectId, ref: 'Alerta_Extravio', default: null },
  },
  {
    collection: 'Mascota',
    versionKey: false,
    id: false,
    toJSON: { virtuals: true, getters: true },
  }
);

// HU05: la edad se calcula desde la fecha de nacimiento (no se guarda)
mascotaSchema.virtual('edad').get(function () {
  const nacimiento = this.fecha_nacimiento;
  if (!nacimiento) return null;

  const hoy = new Date();
  let meses =
    (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth());
  if (hoy.getDate() < nacimiento.getDate()) meses--;

  return { anios: Math.floor(meses / 12), meses: meses % 12 };
});

export const Mascota = model('Mascota', mascotaSchema);