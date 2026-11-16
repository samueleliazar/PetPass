import 'dotenv/config';
import fs from 'fs';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Uso: npm run ocr:probar -- ruta/a/la/foto.jpg
async function main() {
  const ruta = process.argv[2];
  if (!ruta || !fs.existsSync(ruta)) {
    console.error('Uso: npm run ocr:probar -- ruta/a/la/foto.jpg');
    process.exit(1);
  }

  // Lee la llave desde GOOGLE_APPLICATION_CREDENTIALS (en el .env)
  const cliente = new ImageAnnotatorClient();
  const inicio = Date.now();

  // documentTextDetection está pensado para documentos con mucho texto (como un carnet)
  const [resultado] = await cliente.documentTextDetection({
    image: { content: fs.readFileSync(ruta) },
    imageContext: { languageHints: ['es'] },
  });

  const texto = resultado.fullTextAnnotation?.text ?? '';
  const bloques = (resultado.fullTextAnnotation?.pages ?? []).flatMap((p) => p.blocks ?? []);
  const confianza = bloques.length
    ? bloques.reduce((suma, b) => suma + (b.confidence ?? 0), 0) / bloques.length
    : 0;

  console.log('----- Texto leído -----');
  console.log(texto || '(no se encontró texto)');
  console.log('-----------------------');
  console.log(`Confianza promedio: ${(confianza * 100).toFixed(1)} %`);
  console.log(`Tiempo: ${Date.now() - inicio} ms`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});