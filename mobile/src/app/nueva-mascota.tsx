import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Raza = { _id: string; nombre: string };

// Mestizo y Desconocida al final de la lista, el resto en orden alfabético
function ordenarRazas(razas: Raza[]) {
  const alFinal = ['Mestizo', 'Desconocida'];
  return [
    ...razas.filter((r) => !alFinal.includes(r.nombre)),
    ...razas.filter((r) => alFinal.includes(r.nombre)),
  ];
}

export default function NuevaMascota() {
  const [nombre, setNombre] = useState('');
  const [especies, setEspecies] = useState<string[]>([]);
  const [especie, setEspecie] = useState('');
  const [razas, setRazas] = useState<Raza[]>([]);
  const [idRaza, setIdRaza] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [peso, setPeso] = useState('');
  const [cargandoRazas, setCargandoRazas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado');
  }

  // Lista cerrada de especies (una vez)
  useEffect(() => {
    api<string[]>('/razas/especies').then(setEspecies).catch(manejarError);
  }, []);

  // Cada vez que cambia la especie: se borra la raza elegida y se cargan las de esa especie
  useEffect(() => {
    setIdRaza('');
    if (!especie) {
      setRazas([]);
      return;
    }
    setCargandoRazas(true);
    api<Raza[]>(`/razas?especie=${encodeURIComponent(especie)}`)
      .then((lista) => setRazas(ordenarRazas(lista)))
      .catch(manejarError)
      .finally(() => setCargandoRazas(false));
  }, [especie]);

  function validar(): string {
    if (!nombre.trim()) return 'Escribe el nombre de tu mascota';
    if (!especie) return 'Elige la especie';
    if (!idRaza) return 'Elige la raza';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
      return 'La fecha de nacimiento debe tener el formato AAAA-MM-DD (ej: 2022-05-10)';
    }
    const fecha = new Date(fechaNacimiento);
    if (isNaN(fecha.getTime())) return 'La fecha de nacimiento no es válida';
    if (fecha > new Date()) return 'La fecha de nacimiento no puede ser futura';
    if (peso.trim()) {
      const numero = Number(peso.replace(',', '.'));
      if (isNaN(numero) || numero <= 0) return 'El peso debe ser un número mayor a 0';
    }
    return '';
  }

  async function guardar() {
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }

    setError('');
    setGuardando(true);
    try {
      const creada = await api<{ _id: string }>('/mascotas', {
        metodo: 'POST',
        cuerpo: {
          nombre: nombre.trim(),
          especie,
          id_raza: idRaza,
          fecha_nacimiento: fechaNacimiento,
          ...(peso.trim() ? { peso_actual: Number(peso.replace(',', '.')) } : {}),
        },
      });
      // Abrir la ficha de la mascota recién creada (reemplaza este formulario)
      router.replace({ pathname: '/mascota/[id]', params: { id: creada._id } });
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Nueva mascota' }} />

      <ScrollView contentContainerStyle={estilos.contenedor} keyboardShouldPersistTaps="handled">
        <Text style={estilos.etiqueta}>Nombre</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ej: Rocky"
          value={nombre}
          onChangeText={setNombre}
        />

        {/* HU05: especie desde lista cerrada */}
        <Text style={estilos.etiqueta}>Especie</Text>
        <View style={estilos.grupoChips}>
          {especies.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEspecie(e)}
              style={[estilos.chip, especie === e && estilos.chipActivo]}
            >
              <Text style={[estilos.chipTexto, especie === e && estilos.chipTextoActivo]}>{e}</Text>
            </Pressable>
          ))}
        </View>

        {/* HU05: raza filtrada por la especie elegida */}
        <Text style={estilos.etiqueta}>Raza</Text>
        {!especie ? (
          <Text style={estilos.ayuda}>Primero elige la especie</Text>
        ) : cargandoRazas ? (
          <ActivityIndicator color="#2e7d32" style={{ alignSelf: 'flex-start', marginBottom: 16 }} />
        ) : (
          <View style={estilos.grupoChips}>
            {razas.map((r) => (
              <Pressable
                key={r._id}
                onPress={() => setIdRaza(r._id)}
                style={[estilos.chip, idRaza === r._id && estilos.chipActivo]}
              >
                <Text style={[estilos.chipTexto, idRaza === r._id && estilos.chipTextoActivo]}>
                  {r.nombre}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={estilos.etiqueta}>Fecha de nacimiento</Text>
        <TextInput
          style={estilos.input}
          placeholder="AAAA-MM-DD (ej: 2022-05-10)"
          value={fechaNacimiento}
          onChangeText={setFechaNacimiento}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        <Text style={estilos.etiqueta}>Peso en kg (opcional)</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ej: 8.5"
          value={peso}
          onChangeText={setPeso}
          keyboardType="decimal-pad"
        />

        {error ? <Text style={estilos.error}>{error}</Text> : null}

        <Pressable
          style={[estilos.boton, guardando && estilos.botonDesactivado]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.textoBoton}>Guardar mascota</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { padding: 24, paddingBottom: 48 },
  etiqueta: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  ayuda: { color: '#888', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  grupoChips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActivo: { backgroundColor: '#2e7d32' },
  chipTexto: { color: '#2e7d32' },
  chipTextoActivo: { color: '#fff' },
  error: { color: '#c62828', marginBottom: 12, textAlign: 'center' },
  boton: { backgroundColor: '#2e7d32', padding: 16, borderRadius: 10, alignItems: 'center' },
  botonDesactivado: { opacity: 0.6 },
  textoBoton: { color: '#fff', fontSize: 16, fontWeight: '600' },
});