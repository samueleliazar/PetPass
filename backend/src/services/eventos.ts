import { TIPOS_REGISTRO } from '../models/Mascota';

// Acepta un texto opcional (no enviado o string)
function textoOpcional(valor: unknown): boolean {
  return valor === undefined || typeof valor === 'string';
}

export type DatosEvento = {
  tipo_registro: string;
  nombre: string;
  fecha_evento: Date;
  descripcion?: string;
  dosis?: string;
  veterinario?: { nombre?: string; clinica?: string };
  fecha_proxima_dosis: Date | null;
  peso_kg?: number;
};

// Reglas de HU07 y HU08 para un registro nuevo del historial.
// Las usan los registros manuales (POST /eventos) y los del OCR (HU14).
export function validarNuevoEvento(cuerpo: unknown): { error: string } | { datos: DatosEvento } {
  const {
    tipo_registro,
    nombre,
    fecha_evento,
    descripcion,
    dosis,
    veterinario,
    fecha_proxima_dosis,
    peso_kg,
  } = (cuerpo ?? {}) as Record<string, any>;

  if (typeof tipo_registro !== 'string' || !TIPOS_REGISTRO.includes(tipo_registro)) {
    return { error: `Tipo no válido. Opciones: ${TIPOS_REGISTRO.join(', ')}` };
  }
  const esPeso = tipo_registro === 'Peso';

  // Nombre obligatorio, salvo en Peso, donde por defecto se llama "Peso"
  let nombreFinal = typeof nombre === 'string' ? nombre.trim() : '';
  if (esPeso && nombreFinal === '') nombreFinal = 'Peso';
  if (nombreFinal === '') return { error: 'El nombre es obligatorio (por ejemplo: Antirrábica)' };

  // HU07: la fecha no puede ser futura
  const fecha = new Date(fecha_evento);
  if (typeof fecha_evento !== 'string' || isNaN(fecha.getTime())) {
    return { error: 'Fecha no válida (formato AAAA-MM-DD)' };
  }
  if (fecha > new Date()) return { error: 'La fecha no puede ser futura' };

  // HU08: el peso solo se usa en registros de tipo Peso, y ahí es obligatorio
  if (esPeso) {
    if (typeof peso_kg !== 'number' || peso_kg <= 0 || peso_kg > 1000) {
      return { error: 'Para un registro de Peso, peso_kg debe ser un número mayor a 0' };
    }
  } else if (peso_kg !== undefined) {
    return { error: 'peso_kg solo se usa en registros de tipo Peso' };
  }

  if (!textoOpcional(descripcion) || !textoOpcional(dosis)) {
    return { error: 'La descripción y la dosis deben ser texto' };
  }
  if (
    veterinario !== undefined &&
    (typeof veterinario !== 'object' ||
      veterinario === null ||
      !textoOpcional(veterinario.nombre) ||
      !textoOpcional(veterinario.clinica))
  ) {
    return { error: 'Veterinario debe tener la forma { "nombre": "...", "clinica": "..." }' };
  }

  // Próxima dosis: opcional, posterior a la fecha, y no aplica a Peso
  let proxima: Date | null = null;
  if (fecha_proxima_dosis !== undefined && fecha_proxima_dosis !== null && fecha_proxima_dosis !== '') {
    if (esPeso) return { error: 'Un registro de Peso no tiene próxima dosis' };
    proxima = new Date(fecha_proxima_dosis);
    if (typeof fecha_proxima_dosis !== 'string' || isNaN(proxima.getTime())) {
      return { error: 'Fecha de próxima dosis no válida (formato AAAA-MM-DD)' };
    }
    if (proxima <= fecha) return { error: 'La próxima dosis debe ser posterior a la fecha del registro' };
  }

  return {
    datos: {
      tipo_registro,
      nombre: nombreFinal,
      fecha_evento: fecha,
      descripcion,
      dosis,
      veterinario,
      fecha_proxima_dosis: proxima,
      peso_kg: esPeso ? peso_kg : undefined,
    },
  };
}