import { Schema, model } from 'mongoose';

export const ESTADOS_RECORDATORIO = ['Pendiente', 'Enviado', 'Realizado', 'Pospuesto', 'Cancelado'];
export const TIPOS_RECORDATORIO = ['Vacuna', 'Medicamento', 'Tarea General'];

const recordatorioSchema = new Schema(
  {
    id_mascota: { type: Schema.Types.ObjectId, ref: 'Mascota', required: true, index: true },
    id_tutor: { type: Schema.Types.ObjectId, ref: 'Tutor', required: true },
    // Registro del historial que originó el recordatorio (null en tareas generales)
    id_evento: { type: Schema.Types.ObjectId, default: null },
    titulo: { type: String, required: true, trim: true },
    mensaje: { type: String, required: true, trim: true },
    fecha_evento: { type: Date, required: true }, // fecha real de la dosis o tarea
    fecha_programada: { type: Date, required: true }, // cuándo se envía la notificación
    fecha_entrega: { type: Date, default: null },
    estado: { type: String, enum: ESTADOS_RECORDATORIO, default: 'Pendiente' },
    tipo_recordatorio: { type: String, enum: TIPOS_RECORDATORIO, required: true },
  },
  { collection: 'Recordatorio', versionKey: false }
);

// Para que el servicio de envío encuentre rápido los pendientes por fecha
recordatorioSchema.index({ estado: 1, fecha_programada: 1 });

export const Recordatorio = model('Recordatorio', recordatorioSchema);