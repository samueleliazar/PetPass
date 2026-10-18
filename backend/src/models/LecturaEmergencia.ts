import { Schema, model } from 'mongoose';

export const CANALES = ['NFC', 'QR'] as const;

const lecturaSchema = new Schema(
  {
    id_mascota: { type: Schema.Types.ObjectId, ref: 'Mascota', required: true },
    uuid_placa: { type: String, default: null }, // null si se usó el QR
    id_alerta: { type: Schema.Types.ObjectId, ref: 'AlertaExtravio', default: null },
    fecha_hora: { type: Date, required: true, default: Date.now },
    canal: { type: String, enum: CANALES, required: true },
    user_agent: { type: String, default: null, maxlength: 500 },
  },
  { versionKey: false }
);

// Para listar los escaneos de una mascota en orden, y los de cada extravío (HU36)
lecturaSchema.index({ id_mascota: 1, fecha_hora: -1 });
lecturaSchema.index({ id_alerta: 1 });

export const LecturaEmergencia = model('LecturaEmergencia', lecturaSchema);