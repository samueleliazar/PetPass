// HU14: a partir del texto validado, SUGIERE registros. El tutor siempre revisa antes de guardar.

export type Sugerencia = {
  tipo_registro: 'Vacuna' | 'Tratamiento' | 'Receta' | 'Control';
  nombre: string;
  fecha_evento: string | null; // AAAA-MM-DD
  fecha_proxima_dosis: string | null; // AAAA-MM-DD
};

// Palabras conocidas en carnets chilenos (sin tildes ni mayúsculas, para comparar fácil)
const CONOCIDOS: { patron: RegExp; tipo: Sugerencia['tipo_registro']; nombre: string }[] = [
  { patron: /antirrabica|anti rabica|antirabica|rabia/, tipo: 'Vacuna', nombre: 'Antirrábica' },
  { patron: /sextuple/, tipo: 'Vacuna', nombre: 'Séxtuple' },
  { patron: /octuple/, tipo: 'Vacuna', nombre: 'Óctuple' },
  { patron: /quintuple/, tipo: 'Vacuna', nombre: 'Quíntuple' },
  { patron: /triple felina/, tipo: 'Vacuna', nombre: 'Triple felina' },
  { patron: /leucemia/, tipo: 'Vacuna', nombre: 'Leucemia felina' },
  { patron: /tos de las perreras|bordetella|\bkc\b/, tipo: 'Vacuna', nombre: 'Tos de las perreras (KC)' },
  { patron: /desparasit|antiparasit/, tipo: 'Tratamiento', nombre: 'Antiparasitario' },
];

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Fechas como 19-10-2026, 19/10/26 o 19.10.2026 → "2026-10-19"
function fechasDe(linea: string): string[] {
  const encontradas: string[] = [];
  for (const m of linea.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/g)) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || anio < 2000 || anio > 2100) continue;
    const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (!isNaN(new Date(iso).getTime())) encontradas.push(iso);
  }
  return encontradas;
}

export function sugerirRegistros(texto: string): Sugerencia[] {
  const hoy = new Date().toISOString().slice(0, 10);
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ norm: normalizar(l), fechas: fechasDe(l) }));

  // Fecha "general" del documento: la primera fecha pasada cerca de la palabra "fecha"
  let fechaGeneral: string | null = null;
  lineas.forEach((l, i) => {
    if (fechaGeneral || !l.norm.includes('fecha')) return;
    const cerca = [...l.fechas, ...(lineas[i + 1]?.fechas ?? [])].filter((f) => f <= hoy);
    if (cerca.length) fechaGeneral = cerca[0];
  });
  fechaGeneral ??= lineas.flatMap((l) => l.fechas).find((f) => f <= hoy) ?? null;

  const sugerencias: Sugerencia[] = [];
  lineas.forEach((l, i) => {
    const conocido = CONOCIDOS.find((c) => c.patron.test(l.norm));
    if (!conocido) return;
    // Fechas en la misma línea o en las 2 siguientes: las pasadas son la aplicación,
    // las futuras son la próxima dosis
    const cercanas = [l, lineas[i + 1], lineas[i + 2]].filter(Boolean).flatMap((x) => x!.fechas);
    sugerencias.push({
      tipo_registro: conocido.tipo,
      nombre: conocido.nombre,
      fecha_evento: cercanas.find((f) => f <= hoy) ?? fechaGeneral,
      fecha_proxima_dosis: cercanas.find((f) => f > hoy) ?? null,
    });
  });

  // Quitar repetidos (mismo nombre y fecha). Ej.: el título "CERTIFICADO ANTIRRÁBICO" y la línea de la vacuna
  const unicas = new Map<string, Sugerencia>();
  for (const s of sugerencias) {
    const clave = `${s.nombre}|${s.fecha_evento}`;
    const anterior = unicas.get(clave);
    if (!anterior || (!anterior.fecha_proxima_dosis && s.fecha_proxima_dosis)) unicas.set(clave, s);
  }

  // Si no reconoció nada, propone un registro vacío para que el tutor lo complete
  if (unicas.size === 0) {
    return [{ tipo_registro: 'Vacuna', nombre: '', fecha_evento: fechaGeneral, fecha_proxima_dosis: null }];
  }
  return [...unicas.values()];
}