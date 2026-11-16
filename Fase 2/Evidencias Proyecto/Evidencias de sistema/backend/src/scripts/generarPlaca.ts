import 'dotenv/config';
import { generarUuidPlaca } from '../services/placas';

// Uso: npm run placa:nueva          → 1 placa
//      npm run placa:nueva -- 3     → 3 placas
const cantidad = Number(process.argv[2] ?? 1);

console.log(`Códigos de placa válidos (${cantidad}):`);
for (let i = 0; i < cantidad; i++) {
  console.log(generarUuidPlaca());
}