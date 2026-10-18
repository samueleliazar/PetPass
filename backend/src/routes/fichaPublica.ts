import { Router } from 'express';
import { Mascota } from '../models/Mascota';
import { Tutor } from '../models/Tutor';
import { Raza } from '../models/Raza';
import { AlertaExtravio } from '../models/AlertaExtravio';
import { registrarLectura } from '../services/lecturas';

export const fichaPublicaRouter = Router();

// Seguridad: todo texto escrito por usuarios se "escapa" antes de ponerlo en el HTML.
// Así, si alguien escribe <script> en un mensaje, se muestra como texto y no se ejecuta.
function esc(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

function fecha(d?: Date | null): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10).split('-').reverse().join('-');
}

function edad(nacimiento: Date): string {
  const n = new Date(nacimiento);
  const hoy = new Date();
  let meses = (hoy.getFullYear() - n.getFullYear()) * 12 + (hoy.getMonth() - n.getMonth());
  if (hoy.getDate() < n.getDate()) meses--;
  const anios = Math.floor(meses / 12);
  if (anios === 0) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  return `${anios} ${anios === 1 ? 'año' : 'años'}`;
}

function pagina(titulo: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(titulo)} · PetPass</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, system-ui, Roboto, sans-serif; background: #f5f5f5; color: #222; }
  main { max-width: 480px; margin: 0 auto; padding: 16px; }
  .tarjeta { background: #fff; border-radius: 14px; padding: 16px; margin-bottom: 14px; }
  .cabecera { text-align: center; }
  .foto { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; background: #e8f5e9;
          display: flex; align-items: center; justify-content: center; font-size: 56px; margin: 0 auto 8px; }
  h1 { margin: 4px 0; font-size: 28px; }
  .sub { color: #666; margin: 2px 0; }
  .perdido { background: #c62828; color: #fff; }
  .perdido h2 { margin: 0 0 8px; }
  .perdido .detalle { color: #ffebee; font-size: 14px; margin-top: 8px; }
  .aviso { background: #e8f5e9; color: #1b5e20; text-align: center; }
  .boton { display: block; text-align: center; text-decoration: none; background: #2e7d32; color: #fff;
           font-size: 18px; font-weight: 600; padding: 16px; border-radius: 12px; margin-top: 10px; }
  .boton.secundario { background: #fff; color: #2e7d32; border: 2px solid #2e7d32; }
  .critica { background: #fff3e0; border-left: 6px solid #e65100; }
  .critica h2 { color: #e65100; }
  h2 { font-size: 18px; margin: 0 0 8px; }
  ul { margin: 0; padding-left: 20px; }
  li { margin: 4px 0; }
  .pie { text-align: center; color: #999; font-size: 12px; margin: 20px 0; }
</style>
</head>
<body><main>${cuerpo}<p class="pie">Ficha de emergencia · PetPass</p></main></body>
</html>`;
}

// GET /e/:token → ficha pública de emergencia (HU21, HU22, HU24). Sin login.
fichaPublicaRouter.get('/e/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store'); // los datos pueden cambiar (por ejemplo, un extravío nuevo)

  const { token } = req.params;
  const noEncontrada = () =>
    res
      .status(404)
      .send(
        pagina(
          'Medalla no encontrada',
          `<div class="tarjeta cabecera"><div class="foto">🐾</div>
           <h1>Medalla no encontrada</h1>
           <p class="sub">Esta medalla no existe o fue desactivada por su dueño.</p></div>`
        )
      );

  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return noEncontrada();

  // Solo medallas ACTIVAS muestran datos (HU19: una medalla desvinculada deja de mostrar datos)
  const mascota = await Mascota.findOne({
    'medalla.token_publico': token,
    'medalla.estado_vinculacion': 'Activa',
  }).lean();
  if (!mascota) return noEncontrada();

  // Las demás consultas van en paralelo, para responder rápido (HU21: menos de 2 s)
  const [tutor, raza, alerta] = await Promise.all([
    Tutor.findById(mascota.id_tutor).select('telefono contacto_alterno').lean(),
    Raza.findById(mascota.id_raza).select('nombre').lean(),
    mascota.estado_extraviado && mascota.id_alerta_activa
      ? AlertaExtravio.findOne({ _id: mascota.id_alerta_activa, estado: 'Activa' }).lean()
      : null,
  ]);
    // HU25: registrar el escaneo. NO se espera (sin await), para no hacer más lenta la ficha.
  const canal = req.query.c === 'qr' ? 'QR' : 'NFC';
  registrarLectura({
    idMascota: mascota._id,
    idTutor: mascota.id_tutor,
    nombreMascota: mascota.nombre,
    uuidPlaca: canal === 'NFC' ? (mascota.medalla?.uuid_placa ?? null) : null,
    idAlerta: alerta?._id ?? null,
    canal,
    userAgent: req.get('user-agent'),
  }).catch((e) => console.error('No se pudo registrar la lectura:', e));

  const vis = mascota.visibilidad_publica ?? {
  telefono: true,
  alergias: true,
  tratamientos: false,
  vacunas: false,
};
  const eventos = mascota.eventos_clinicos ?? [];
  const recientes = (tipos: string[]) =>
    eventos
      .filter((e) => tipos.includes(e.tipo_registro))
      .sort((a, b) => new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime())
      .slice(0, 5);

  let cuerpo = '';

  // Cabecera: foto, nombre, especie y raza, edad
  cuerpo += `<div class="tarjeta cabecera">
    ${mascota.foto_perfil_url
      ? `<img class="foto" src="${esc(mascota.foto_perfil_url)}" alt="Foto de ${esc(mascota.nombre)}">`
      : `<div class="foto">🐾</div>`}
    <h1>${esc(mascota.nombre)}</h1>
    <p class="sub">${esc(mascota.especie)}${raza ? ` · ${esc(raza.nombre)}` : ''}</p>
    <p class="sub">${esc(edad(mascota.fecha_nacimiento))}</p>
  </div>`;

  // HU21 y HU34: si está extraviada, el mensaje de la alerta ACTIVA
  if (alerta) {
    cuerpo += `<div class="tarjeta perdido">
      <h2>🚨 ¡Estoy perdido/a!</h2>
      <p>${esc(alerta.mensaje)}</p>
      ${alerta.ultima_ubicacion ? `<p class="detalle">Última vez visto/a: ${esc(alerta.ultima_ubicacion)}</p>` : ''}
      <p class="detalle">Reportado el ${fecha(alerta.fecha_inicio)}</p>
    </div>`;
  } else {
    cuerpo += `<div class="tarjeta aviso">Si me encontraste, por favor contacta a mi familia. ¡Gracias!</div>`;
  }

  // HU21 y HU04: botón de llamar (ambos números, solo si el teléfono es visible)
  if (vis.telefono && tutor?.telefono) {
    cuerpo += `<div class="tarjeta">
      <a class="boton" href="tel:${esc(tutor.telefono)}">📞 Llamar a mi familia</a>
      ${tutor.contacto_alterno
        ? `<a class="boton secundario" href="tel:${esc(tutor.contacto_alterno)}">📞 Contacto alterno</a>`
        : ''}
    </div>`;
  }

  // HU24 y HU23: condiciones críticas, SIEMPRE visibles
  if (mascota.condiciones_criticas?.length) {
    cuerpo += `<div class="tarjeta critica"><h2>⚠️ Condiciones importantes</h2><ul>
      ${mascota.condiciones_criticas.map((c) => `<li>${esc(c)}</li>`).join('')}
    </ul></div>`;
  }

  // HU24: lo demás, solo si el tutor lo marcó como público
  if (vis.alergias && mascota.alergias?.length) {
    cuerpo += `<div class="tarjeta critica"><h2>Alergias</h2><ul>
      ${mascota.alergias.map((a) => `<li>${esc(a)}</li>`).join('')}
    </ul></div>`;
  }

  const tratamientos = recientes(['Tratamiento', 'Receta']);
  if (vis.tratamientos && tratamientos.length) {
    cuerpo += `<div class="tarjeta"><h2>💊 Tratamientos recientes</h2><ul>
      ${tratamientos
        .map((t) => `<li>${esc(t.nombre)}${t.dosis ? ` · ${esc(t.dosis)}` : ''} (${fecha(t.fecha_evento)})</li>`)
        .join('')}
    </ul></div>`;
  }

  const vacunas = recientes(['Vacuna']);
  if (vis.vacunas && vacunas.length) {
    cuerpo += `<div class="tarjeta"><h2>💉 Vacunas</h2><ul>
      ${vacunas.map((v) => `<li>${esc(v.nombre)} (${fecha(v.fecha_evento)})</li>`).join('')}
    </ul></div>`;
  }

  // HU24 y HU23: nunca se muestran el correo ni los documentos escaneados (simplemente no se consultan)
  res.send(pagina(mascota.nombre, cuerpo));
});