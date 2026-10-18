import { Schema, model } from 'mongoose';
import { ESPECIES } from './Raza';

export const TIPOS_REGISTRO = ['Vacuna', 'Tratamiento', 'Receta', 'Peso', 'Control'];

// Subdocumento: cada elemento del historial clínico
const eventoClinicoSchema = new Schema({
  id_documento: { type: Schema.Types.ObjectId, ref: 'Documento', default: null },
  tipo_registro: { type: String, enum: TIPOS_REGISTRO, required: true },
  nombre: { type: String, required: true, trim: true },
  fecha_evento: { type: Date, required: true },
  descripcion: { type: String, trim: true },
  dosis: { type: String, trim: true },
  veterinario: {
    nombre: { type: String, trim: true },
    clinica: { type: String, trim: true },
  },
  origen: { type: String, enum: ['Manual', 'OCR'], required: true, default: 'Manual' },
  fecha_proxima_dosis: { type: Date, default: null },
  peso_kg: { type: Number, min: 0 },
});
// Subdocumento: medalla QR/NFC del collar (a lo más una por mascota)
const medallaSchema = new Schema(
  {
    uuid_placa: { type: String, required: true },
    uid_nfc: { type: String }, // se completa al leer el chip NFC (opcional si se vincula por QR)
    token_publico: { type: String, required: true },
    estado_vinculacion: { type: String, enum: ['Activa', 'Desvinculada'], default: 'Activa' },
    url_emergencia: { type: String, required: true },
    fecha_vinculacion: { type: Date, default: Date.now },
  },
  { _id: false }
);
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
        eventos_clinicos: { type: [eventoClinicoSchema], default: [] },
        medalla: { type: medallaSchema, default: undefined },
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
// Una placa no puede estar en dos mascotas, y el token público debe ser único.
// Son "parciales": solo aplican a las mascotas que tienen medalla.
mascotaSchema.index(
  { 'medalla.uuid_placa': 1 },
  { unique: true, partialFilterExpression: { 'medalla.uuid_placa': { $type: 'string' } } }
);
mascotaSchema.index(
  { 'medalla.token_publico': 1 },
  { unique: true, partialFilterExpression: { 'medalla.token_publico': { $type: 'string' } } }
);
mascotaSchema.index(
  { 'medalla.uid_nfc': 1 },
  { unique: true, partialFilterExpression: { 'medalla.uid_nfc': { $type: 'string' } } }
);
export const Mascota = model('Mascota', mascotaSchema);