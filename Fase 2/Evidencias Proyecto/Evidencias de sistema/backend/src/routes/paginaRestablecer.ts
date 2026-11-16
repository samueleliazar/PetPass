import { Router } from 'express';

export const paginaRestablecerRouter = Router();

// GET /restablecer?token=... → página que abre el enlace del correo (HU03)
// El formulario envía los datos a POST /auth/restablecer, que ya valida el token.
paginaRestablecerRouter.get('/restablecer', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer'); // el token no se filtra a otras páginas
  res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Nueva contraseña · PetPass</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, system-ui, Roboto, sans-serif; background: #f5f5f5; color: #222; }
  main { max-width: 420px; margin: 0 auto; padding: 24px 16px; }
  .tarjeta { background: #fff; border-radius: 14px; padding: 20px; }
  h1 { font-size: 24px; margin: 0 0 6px; color: #2e7d32; }
  p { color: #555; margin: 0 0 16px; }
  label { display: block; font-weight: 600; margin: 12px 0 6px; }
  input { width: 100%; padding: 12px; font-size: 16px; border: 1px solid #ccc; border-radius: 10px; }
  button { width: 100%; margin-top: 18px; padding: 14px; font-size: 17px; font-weight: 600;
           color: #fff; background: #2e7d32; border: 0; border-radius: 12px; }
  button:disabled { opacity: .6; }
  .error { color: #c62828; margin-top: 12px; }
  .ok { text-align: center; }
  .oculto { display: none; }
</style>
</head>
<body><main>
  <div class="tarjeta" id="formulario">
    <h1>🐾 Nueva contraseña</h1>
    <p>Escribe tu nueva contraseña de PetPass (mínimo 8 caracteres).</p>
    <form id="form">
      <label for="p1">Nueva contraseña</label>
      <input id="p1" type="password" autocomplete="new-password" minlength="8" required>
      <label for="p2">Repite la contraseña</label>
      <input id="p2" type="password" autocomplete="new-password" minlength="8" required>
      <button id="boton" type="submit">Guardar contraseña</button>
      <p class="error" id="error"></p>
    </form>
  </div>
  <div class="tarjeta ok oculto" id="listo">
    <h1>✅ ¡Listo!</h1>
    <p>Tu contraseña fue actualizada. Vuelve a la app de PetPass e inicia sesión.</p>
  </div>
</main>
<script>
  // El token se lee de la dirección (no se escribe en el HTML)
  const token = new URLSearchParams(location.search).get('token') || '';
  const form = document.getElementById('form');
  const error = document.getElementById('error');
  const boton = document.getElementById('boton');

  if (!token) error.textContent = 'El enlace no es válido. Solicita uno nuevo desde la app.';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    const p1 = document.getElementById('p1').value;
    const p2 = document.getElementById('p2').value;
    if (p1.length < 8) { error.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
    if (p1 !== p2) { error.textContent = 'Las contraseñas no coinciden.'; return; }

    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      const r = await fetch('/auth/restablecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: p1 }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudo cambiar la contraseña.');
      document.getElementById('formulario').classList.add('oculto');
      document.getElementById('listo').classList.remove('oculto');
    } catch (err) {
      error.textContent = err.message;
      boton.disabled = false;
      boton.textContent = 'Guardar contraseña';
    }
  });
</script>
</body>
</html>`);
});