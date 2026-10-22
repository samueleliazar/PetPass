import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

const TIPOS = ['Vacuna', 'Tratamiento', 'Receta', 'Control'] as const;
type Tipo = (typeof TIPOS)[number];

type Sugerencia = {
  tipo_registro: Tipo;
  nombre: string;
  fecha_evento: string | null; // AAAA-MM-DD
  fecha_proxima_dosis: string | null;
};

// Lo que el tutor edita en pantalla (fechas en formato DD-MM-AAAA, como las escribimos en Chile)
type Fila = { clave: number; tipo: Tipo; nombre: string; fecha: string; dosis: string; proxima: string };

function isoADmy(iso: string | null) {
  return iso ? iso.slice(0, 10).split('-').reverse().join('-') : '';
}
// "19-10-2026" → "2026-10-19"; null si no es una fecha válida
function dmyAIso(texto: string): string | null {
  const m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const fecha = new Date(iso);
  return isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== iso ? null : iso;
}

let siguienteClave = 1;
function filaVacia(): Fila {
  return { clave: siguienteClave++, tipo: 'Vacuna', nombre: '', fecha: '', dosis: '', proxima: '' };
}

export default function Convertir() {
  const { id, docId } = useLocalSearchParams<{ id: string; docId: string }>();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
  }

  useEffect(() => {
    api<Sugerencia[]>(`/mascotas/${id}/documentos/${docId}/sugerencias`)
      .then((sugerencias) =>
        setFilas(
          sugerencias.map((s) => ({
            clave: siguienteClave++,
            tipo: s.tipo_registro,
            nombre: s.nombre,
            fecha: isoADmy(s.fecha_evento),
            dosis: '',
            proxima: isoADmy(s.fecha_proxima_dosis),
          }))
        )
      )
      .catch(manejarError);
  }, [id, docId]);

  function cambiar(clave: number, campo: keyof Fila, valor: string) {
    setFilas((actual) => actual!.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  }
  function quitar(clave: number) {
    setFilas((actual) => actual!.filter((f) => f.clave !== clave));
  }

  async function guardar() {
    if (!filas || filas.length === 0) return Alert.alert('Sin registros', 'Agrega al menos un registro.');

    // Revisión rápida en el teléfono (el backend vuelve a revisar todo)
    const registros = [];
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const n = i + 1;
      if (!f.nombre.trim()) return Alert.alert(`Registro ${n}`, 'Falta el nombre (por ejemplo: Antirrábica).');
      const fecha = dmyAIso(f.fecha);
      if (!fecha) return Alert.alert(`Registro ${n}`, 'La fecha debe tener el formato DD-MM-AAAA.');
      let proxima: string | undefined;
      if (f.proxima.trim()) {
        const p = dmyAIso(f.proxima);
        if (!p) return Alert.alert(`Registro ${n}`, 'La próxima dosis debe tener el formato DD-MM-AAAA.');
        proxima = p;
      }
      registros.push({
        tipo_registro: f.tipo,
        nombre: f.nombre.trim(),
        fecha_evento: fecha,
        dosis: f.dosis.trim() || undefined,
        fecha_proxima_dosis: proxima,
      });
    }

    setGuardando(true);
    try {
      const r = await api<{ total: number }>(`/mascotas/${id}/documentos/${docId}/registros`, {
        metodo: 'POST',
        cuerpo: { registros },
      });
      Alert.alert(
        '¡Listo!',
        `Se ${r.total === 1 ? 'agregó 1 registro' : `agregaron ${r.total} registros`} al historial.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardando(false);
    }
  }

  if (!filas) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={estilos.fondo} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={estilos.intro}>
          Revisa los registros que encontramos en el documento. Corrige lo necesario, quita los que
          sobren o agrega otros.
        </Text>

        {filas.map((f, i) => (
          <View key={f.clave} style={estilos.tarjeta}>
            <View style={estilos.cabecera}>
              <Text style={estilos.numero}>Registro {i + 1}</Text>
              <Pressable onPress={() => quitar(f.clave)} hitSlop={10}>
                <Text style={estilos.quitar}>✕ Quitar</Text>
              </Pressable>
            </View>

            <View style={estilos.chips}>
              {TIPOS.map((t) => (
                <Pressable
                  key={t}
                  style={[estilos.chip, f.tipo === t && estilos.chipActivo]}
                  onPress={() => cambiar(f.clave, 'tipo', t)}
                >
                  <Text style={[estilos.textoChip, f.tipo === t && { color: '#fff' }]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={estilos.etiqueta}>Nombre</Text>
            <TextInput
              style={estilos.input}
              value={f.nombre}
              onChangeText={(v) => cambiar(f.clave, 'nombre', v)}
              placeholder="Ej: Antirrábica"
            />

            <Text style={estilos.etiqueta}>Fecha (DD-MM-AAAA)</Text>
            <TextInput
              style={estilos.input}
              value={f.fecha}
              onChangeText={(v) => cambiar(f.clave, 'fecha', v)}
              placeholder="19-10-2026"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={estilos.etiqueta}>Dosis (opcional)</Text>
            <TextInput
              style={estilos.input}
              value={f.dosis}
              onChangeText={(v) => cambiar(f.clave, 'dosis', v)}
              placeholder="Ej: 1 ml"
            />

            <Text style={estilos.etiqueta}>Próxima dosis (opcional, DD-MM-AAAA)</Text>
            <TextInput
              style={estilos.input}
              value={f.proxima}
              onChangeText={(v) => cambiar(f.clave, 'proxima', v)}
              placeholder="19-10-2027"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        ))}

        <Pressable style={estilos.agregar} onPress={() => setFilas([...filas, filaVacia()])}>
          <Text style={estilos.textoAgregar}>＋ Agregar otro registro</Text>
        </Pressable>

        <Pressable
          style={[estilos.boton, guardando && { opacity: 0.6 }]}
          onPress={guardar}
          disabled={guardando}
        >
          <Text style={estilos.textoBoton}>
            {guardando ? 'Guardando…' : `Agregar ${filas.length} al historial`}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { color: '#555', fontSize: 15, marginBottom: 12 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12 },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  numero: { fontWeight: '700', fontSize: 16, color: '#222' },
  quitar: { color: '#c62828', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: '#2e7d32', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipActivo: { backgroundColor: '#2e7d32' },
  textoChip: { color: '#2e7d32', fontWeight: '600' },
  etiqueta: { fontSize: 13, color: '#666', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 10, fontSize: 15 },
  agregar: { padding: 14, alignItems: 'center' },
  textoAgregar: { color: '#2e7d32', fontWeight: '600', fontSize: 16 },
  boton: { backgroundColor: '#2e7d32', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 30 },
  textoBoton: { color: '#fff', fontWeight: '600', fontSize: 16 },
});