import { Schema, model, Types } from 'mongoose';

export const ESTADOS_DOCUMENTO = ['Pendiente', 'Validado'] as const;

const documentoSchema = new Schema(
  {
    id_mascota: { type: Schema.Types.ObjectId, ref: 'Mascota', required: true },
    // Ruta del archivo dentro del bucket (ej: mascotas/ID/123.jpg). Nunca se modifica (HU13).
    imagen_url: { type: String, required: true },
    texto_ocr_raw: { type: String, default: '' },
    texto_validado: { type: String, default: null },
    confianza_ocr: {
      type: Schema.Types.Decimal128,
      default: null,
      // Se entrega como número normal (ej: 0.861) en vez del formato especial de Decimal128
      get: (v: Types.Decimal128 | null) => (v == null ? null : parseFloat(v.toString())),
    },
    estado: { type: String, enum: ESTADOS_DOCUMENTO, default: 'Pendiente', required: true },
    fecha_carga: { type: Date, default: Date.now, required: true },
  },
  { versionKey: false, toJSON: { getters: true }, toObject: { getters: true }, id: false }
);

documentoSchema.index({ id_mascota: 1, fecha_carga: -1 });

export const Documento = model('Documento', documentoSchema);