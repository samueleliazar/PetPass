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
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Raza = { _id: string; nombre: string };

type Ficha = {
  _id: string;
  nombre: string;
  especie: string;
  id_raza: { _id: string; nombre: string } | null;
  fecha_nacimiento: string;
  alergias: string[];
  condiciones_criticas: string[];
};

function ordenarRazas(razas: Raza[]) {
  const alFinal = ['Mestizo', 'Desconocida'];
  return [
    ...razas.filter((r) => !alFinal.includes(r.nombre)),
    ...razas.filter((r) => alFinal.includes(r.nombre)),
  ];
}

// Editor de una lista de textos (alergias o condiciones): escribir + Agregar, y ✕ para quitar
function EditorLista({
  etiqueta,
  ayuda,
  placeholder,
  valores,
  setValores,
  colorChip,
}: {
  etiqueta: string;
  ayuda: string;
  placeholder: string;
  valores: string[];
  setValores: (v: string[]) => void;
  colorChip: string;
}) {
  const [nuevo, setNuevo] = useState('');

  function agregar() {
    const texto = nuevo.trim();
    if (!texto) return;
    const yaExiste = valores.some((v) => v.toLowerCase() === texto.toLowerCase());
    if (!yaExiste) setValores([...valores, texto]);
    setNuevo('');
  }

  return (
    <>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text style={estilos.ayuda}>{ayuda}</Text>

      <View style={estilos.grupoChips}>
        {valores.map((v) => (
          <Pressable
            key={v}
            onPress={() => setValores(valores.filter((x) => x !== v))}
            style={[estilos.chipLista, { backgroundColor: colorChip }]}
          >
            <Text style={estilos.chipListaTexto}>{v}  ✕</Text>
          </Pressable>
        ))}
      </View>

      <View style={estilos.filaAgregar}>
        <TextInput
          style={[estilos.input, { flex: 1, marginBottom: 0 }]}
          placeholder={placeholder}
          value={nuevo}
          onChangeText={setNuevo}
          onSubmitEditing={agregar}
          returnKeyType="done"
        />
        <Pressable style={estilos.botonAgregar} onPress={agregar}>
          <Text style={estilos.botonAgregarTexto}>Agregar</Text>
        </Pressable>
      </View>
    </>
  );
}

export default function EditarMascota() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [cargando, setCargando] = useState(true);
  const [nombreOriginal, setNombreOriginal] = useState('');
  const [nombre, setNombre] = useState('');
  const [especies, setEspecies] = useState<string[]>([]);
  const [especie, setEspecie] = useState('');
  const [razas, setRazas] = useState<Raza[]>([]);
  const [idRaza, setIdRaza] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [alergias, setAlergias] = useState<string[]>([]);
  const [condiciones, setCondiciones] = useState<string[]>([]);
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

  // Cargar especies y los datos actuales de la mascota
  useEffect(() => {
    Promise.all([api<string[]>('/razas/especies'), api<Ficha>(`/mascotas/${id}`)])
      .then(([listaEspecies, ficha]) => {
        setEspecies(listaEspecies);
        setNombreOriginal(ficha.nombre);
        setNombre(ficha.nombre);
        setEspecie(ficha.especie);
        setIdRaza(ficha.id_raza?._id ?? '');
        setFechaNacimiento(ficha.fecha_nacimiento.slice(0, 10));
        setAlergias(ficha.alergias);
        setCondiciones(ficha.condiciones_criticas);
      })
      .catch(manejarError)
      .finally(() => setCargando(false));
  }, [id]);

  // Cargar las razas de la especie actual
  useEffect(() => {
    if (!especie) return;
    setCargandoRazas(true);
    api<Raza[]>(`/razas?especie=${encodeURIComponent(especie)}`)
      .then((lista) => setRazas(ordenarRazas(lista)))
      .catch(manejarError)
      .finally(() => setCargandoRazas(false));
  }, [especie]);

  // HU06: si cambia la especie, hay que volver a elegir la raza
  function elegirEspecie(e: string) {
    if (e === especie) return;
    setEspecie(e);
    setIdRaza('');
  }

  function validar(): string {
    if (!nombre.trim()) return 'El nombre no puede quedar vacío';
    if (!idRaza) return 'Elige la raza (cambiaste la especie)';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) return 'La fecha debe tener el formato AAAA-MM-DD';
    if (isNaN(new Date(fechaNacimiento).getTime())) return 'La fecha de nacimiento no es válida';
    if (new Date(fechaNacimiento) > new Date()) return 'La fecha de nacimiento no puede ser futura';
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
      await api(`/mascotas/${id}`, {
        metodo: 'PATCH',
        cuerpo: {
          nombre: nombre.trim(),
          especie,
          id_raza: idRaza,
          fecha_nacimiento: fechaNacimiento,
          alergias,
          condiciones_criticas: condiciones,
        },
      });
      router.back(); // vuelve a la ficha, que se recarga sola
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardando(false);
    }
  }

  // HU06: eliminar pide confirmación y borra todo lo asociado
  function confirmarEliminar() {
    Alert.alert(
      `¿Eliminar a ${nombreOriginal}?`,
      'Se borrará su ficha, todo su historial clínico, sus recordatorios y sus reportes de extravío. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/mascotas/${id}`, { metodo: 'DELETE' });
              // Volver a la lista de mascotas, cerrando la ficha y esta pantalla
              if (router.canDismiss()) router.dismissAll();
              else router.replace('/mascotas');
            } catch (e) {
              await manejarError(e);
            }
          },
        },
      ]
    );
  }

  if (cargando) {
    return <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 40 }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: `Editar a ${nombreOriginal}` }} />

      <ScrollView contentContainerStyle={estilos.contenedor} keyboardShouldPersistTaps="handled">
        <Text style={estilos.etiqueta}>Nombre</Text>
        <TextInput style={estilos.input} value={nombre} onChangeText={setNombre} />

        <Text style={estilos.etiqueta}>Especie</Text>
        <View style={estilos.grupoChips}>
          {especies.map((e) => (
            <Pressable
              key={e}
              onPress={() => elegirEspecie(e)}
              style={[estilos.chip, especie === e && estilos.chipActivo]}
            >
              <Text style={[estilos.chipTexto, especie === e && estilos.chipTextoActivo]}>{e}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={estilos.etiqueta}>Raza</Text>
        {cargandoRazas ? (
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
          placeholder="AAAA-MM-DD"
          value={fechaNacimiento}
          onChangeText={setFechaNacimiento}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        {/* HU08: alergias y condiciones críticas (van en la ficha principal) */}
        <EditorLista
          etiqueta="⚠️ Condiciones críticas"
          ayuda="Lo que debe saber quien encuentre a tu mascota (ej: epilepsia, diabetes). Siempre se mostrarán en la ficha de emergencia."
          placeholder="Ej: Epilepsia"
          valores={condiciones}
          setValores={setCondiciones}
          colorChip="#e65100"
        />
        <View style={{ height: 16 }} />
        <EditorLista
          etiqueta="Alergias"
          ayuda="Toca una para quitarla."
          placeholder="Ej: Penicilina"
          valores={alergias}
          setValores={setAlergias}
          colorChip="#ef6c00"
        />

        {error ? <Text style={estilos.error}>{error}</Text> : null}

        <Pressable
          style={[estilos.boton, guardando && estilos.botonDesactivado, { marginTop: 24 }]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.textoBoton}>Guardar cambios</Text>
          )}
        </Pressable>

        <Pressable style={estilos.botonEliminar} onPress={confirmarEliminar}>
          <Text style={estilos.botonEliminarTexto}>Eliminar mascota</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { padding: 24, paddingBottom: 48 },
  etiqueta: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  ayuda: { color: '#888', marginBottom: 8, fontSize: 13 },
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
  chipLista: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipListaTexto: { color: '#fff', fontWeight: '600' },
  filaAgregar: { flexDirection: 'row', alignItems: 'center' },
  botonAgregar: {
    marginLeft: 8,
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  botonAgregarTexto: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 16, textAlign: 'center' },
  boton: { backgroundColor: '#2e7d32', padding: 16, borderRadius: 10, alignItems: 'center' },
  botonDesactivado: { opacity: 0.6 },
  textoBoton: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botonEliminar: {
    marginTop: 16,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c62828',
  },
  botonEliminarTexto: { color: '#c62828', fontSize: 16, fontWeight: '600' },
});