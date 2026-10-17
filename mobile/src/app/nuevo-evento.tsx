import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
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

const TIPOS = ['Vacuna', 'Tratamiento', 'Receta', 'Control', 'Peso'] as const;
type Tipo = (typeof TIPOS)[number];

const EJEMPLO_NOMBRE: Record<Tipo, string> = {
  Vacuna: 'Ej: Antirrábica',
  Tratamiento: 'Ej: Antiparasitario',
  Receta: 'Ej: Amoxicilina',
  Control: 'Ej: Control anual',
  Peso: '',
};

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Fecha de hoy en formato AAAA-MM-DD (hora local del teléfono)
function hoy() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Una etiqueta + un campo de texto, para no repetir lo mismo en cada campo
function Campo({ etiqueta, ...props }: { etiqueta: string } & TextInputProps) {
  return (
    <>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput style={estilos.input} {...props} />
    </>
  );
}

export default function NuevoEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [tipo, setTipo] = useState<Tipo>('Vacuna');
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [dosis, setDosis] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [vetNombre, setVetNombre] = useState('');
  const [vetClinica, setVetClinica] = useState('');
  const [proxima, setProxima] = useState('');
  const [peso, setPeso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const esPeso = tipo === 'Peso';
  const llevaDosis = tipo === 'Vacuna' || tipo === 'Tratamiento' || tipo === 'Receta';

  function validar(): string {
    if (!esPeso && !nombre.trim()) return 'Escribe el nombre del registro';
    if (!FORMATO_FECHA.test(fecha)) return 'La fecha debe tener el formato AAAA-MM-DD';
    if (fecha > hoy()) return 'La fecha no puede ser futura';
    if (esPeso) {
      const numero = Number(peso.replace(',', '.'));
      if (!peso.trim() || isNaN(numero) || numero <= 0) return 'Indica el peso en kg (ej: 8.5)';
    }
    if (!esPeso && proxima.trim()) {
      if (!FORMATO_FECHA.test(proxima)) return 'La próxima fecha debe tener el formato AAAA-MM-DD';
      if (proxima <= fecha) return 'La próxima fecha debe ser posterior a la fecha del registro';
    }
    return '';
  }

  async function guardar() {
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }

    // Solo enviamos los campos que corresponden al tipo y que el usuario llenó
    const cuerpo: Record<string, unknown> = { tipo_registro: tipo, fecha_evento: fecha };
    if (esPeso) {
      cuerpo.peso_kg = Number(peso.replace(',', '.'));
    } else {
      cuerpo.nombre = nombre.trim();
      if (llevaDosis && dosis.trim()) cuerpo.dosis = dosis.trim();
      if (descripcion.trim()) cuerpo.descripcion = descripcion.trim();
      if (vetNombre.trim() || vetClinica.trim()) {
        cuerpo.veterinario = {
          ...(vetNombre.trim() ? { nombre: vetNombre.trim() } : {}),
          ...(vetClinica.trim() ? { clinica: vetClinica.trim() } : {}),
        };
      }
      if (proxima.trim()) cuerpo.fecha_proxima_dosis = proxima.trim();
    }

    setError('');
    setGuardando(true);
    try {
      await api(`/mascotas/${id}/eventos`, { metodo: 'POST', cuerpo });

      // Si tiene próxima fecha y es futura, el backend creó un recordatorio (HU15)
      const conRecordatorio = !esPeso && proxima.trim() !== '' && proxima > hoy();
      Alert.alert(
        'Registro guardado',
        conRecordatorio ? 'Te avisaremos 48 horas antes de la próxima fecha.' : undefined,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) {
        await borrarToken();
        router.replace('/login');
        return;
      }
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Nuevo registro' }} />

      <ScrollView contentContainerStyle={estilos.contenedor} keyboardShouldPersistTaps="handled">
        <Text style={estilos.etiqueta}>Tipo de registro</Text>
        <View style={estilos.grupoChips}>
          {TIPOS.map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTipo(t);
                setError('');
              }}
              style={[estilos.chip, tipo === t && estilos.chipActivo]}
            >
              <Text style={[estilos.chipTexto, tipo === t && estilos.chipTextoActivo]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {!esPeso && (
          <Campo
            etiqueta="Nombre"
            placeholder={EJEMPLO_NOMBRE[tipo]}
            value={nombre}
            onChangeText={setNombre}
          />
        )}

        <Campo
          etiqueta={esPeso ? 'Fecha del pesaje' : 'Fecha de aplicación o atención'}
          placeholder="AAAA-MM-DD"
          value={fecha}
          onChangeText={setFecha}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        {esPeso ? (
          <Campo
            etiqueta="Peso en kg"
            placeholder="Ej: 8.5"
            value={peso}
            onChangeText={setPeso}
            keyboardType="decimal-pad"
          />
        ) : (
          <>
            {llevaDosis && (
              <Campo etiqueta="Dosis (opcional)" placeholder="Ej: 1 ml" value={dosis} onChangeText={setDosis} />
            )}
            <Campo
              etiqueta="Veterinario (opcional)"
              placeholder="Ej: Dra. Pérez"
              value={vetNombre}
              onChangeText={setVetNombre}
            />
            <Campo
              etiqueta="Clínica (opcional)"
              placeholder="Ej: Clínica Vet Sur"
              value={vetClinica}
              onChangeText={setVetClinica}
            />
            <Campo
              etiqueta="Descripción (opcional)"
              placeholder="Indicaciones, observaciones..."
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
            />
            <Campo
              etiqueta={tipo === 'Control' ? 'Próximo control (opcional)' : 'Próxima dosis (opcional)'}
              placeholder="AAAA-MM-DD"
              value={proxima}
              onChangeText={setProxima}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </>
        )}

        {error ? <Text style={estilos.error}>{error}</Text> : null}

        <Pressable
          style={[estilos.boton, guardando && estilos.botonDesactivado]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.textoBoton}>Guardar registro</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { padding: 24, paddingBottom: 48 },
  etiqueta: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
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