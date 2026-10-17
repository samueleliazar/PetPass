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

type MascotaBasica = { _id: string; nombre: string };

function manana() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NuevoRecordatorio() {
  const [mascotas, setMascotas] = useState<MascotaBasica[]>([]);
  const [idMascota, setIdMascota] = useState('');
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [fecha, setFecha] = useState(manana());
  const [hora, setHora] = useState('09:00');
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

  // Mascotas del tutor, para elegir a cuál corresponde el recordatorio
  useEffect(() => {
    api<MascotaBasica[]>('/mascotas')
      .then((lista) => {
        setMascotas(lista);
        if (lista.length === 1) setIdMascota(lista[0]._id); // si tiene una sola, la dejamos elegida
      })
      .catch(manejarError);
  }, []);

  function validar(): string {
    if (!idMascota) return 'Elige la mascota';
    if (!titulo.trim()) return 'Escribe un título (ej: Comprar alimento)';
    if (!mensaje.trim()) return 'Escribe un mensaje';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'La fecha debe tener el formato AAAA-MM-DD';
    if (!/^\d{2}:\d{2}$/.test(hora)) return 'La hora debe tener el formato HH:MM (ej: 09:00)';
    const cuando = new Date(`${fecha}T${hora}:00`);
    if (isNaN(cuando.getTime())) return 'La fecha u hora no es válida';
    if (cuando <= new Date()) return 'La fecha y hora deben ser futuras';
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
      await api('/recordatorios', {
        metodo: 'POST',
        cuerpo: {
          id_mascota: idMascota,
          titulo: titulo.trim(),
          mensaje: mensaje.trim(),
          // Se envía con zona horaria (ISO), para que el aviso quede a la hora que eligió el tutor
          fecha: new Date(`${fecha}T${hora}:00`).toISOString(),
        },
      });
      router.back();
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
      <Stack.Screen options={{ title: 'Nuevo recordatorio' }} />

      <ScrollView contentContainerStyle={estilos.contenedor} keyboardShouldPersistTaps="handled">
        <Text style={estilos.etiqueta}>Mascota</Text>
        {mascotas.length === 0 ? (
          <Text style={estilos.ayuda}>Primero agrega una mascota.</Text>
        ) : (
          <View style={estilos.grupoChips}>
            {mascotas.map((m) => (
              <Pressable
                key={m._id}
                onPress={() => setIdMascota(m._id)}
                style={[estilos.chip, idMascota === m._id && estilos.chipActivo]}
              >
                <Text style={[estilos.chipTexto, idMascota === m._id && estilos.chipTextoActivo]}>
                  {m.nombre}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={estilos.etiqueta}>Título</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ej: Comprar alimento"
          value={titulo}
          onChangeText={setTitulo}
        />

        <Text style={estilos.etiqueta}>Mensaje</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ej: Queda poco alimento"
          value={mensaje}
          onChangeText={setMensaje}
          multiline
        />

        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 2, marginRight: 12 }}>
            <Text style={estilos.etiqueta}>Fecha</Text>
            <TextInput
              style={estilos.input}
              placeholder="AAAA-MM-DD"
              value={fecha}
              onChangeText={setFecha}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={estilos.etiqueta}>Hora</Text>
            <TextInput
              style={estilos.input}
              placeholder="HH:MM"
              value={hora}
              onChangeText={setHora}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>

        {error ? <Text style={estilos.error}>{error}</Text> : null}

        <Pressable
          style={[estilos.boton, guardando && estilos.botonDesactivado]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.textoBoton}>Guardar recordatorio</Text>
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