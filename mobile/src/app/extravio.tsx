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

type Alerta = {
  _id: string;
  mensaje: string;
  ultima_ubicacion?: string;
  fecha_inicio: string;
  fecha_actualizacion?: string | null;
  fecha_cierre?: string | null;
  estado: 'Activa' | 'Cerrada';
};

const LARGO_MAXIMO = 500;

// Fecha y hora en la zona horaria del teléfono: "17-10-2026 17:20"
function fechaHora(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export default function Extravio() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [nombreMascota, setNombreMascota] = useState('');
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const activa = alertas.find((a) => a.estado === 'Activa');
  const anteriores = alertas.filter((a) => a.estado === 'Cerrada');

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado');
  }

  useEffect(() => {
    Promise.all([
      api<{ nombre: string }>(`/mascotas/${id}`),
      api<Alerta[]>(`/mascotas/${id}/extravios`),
    ])
      .then(([ficha, lista]) => {
        setNombreMascota(ficha.nombre);
        setAlertas(lista);
        // Si hay un extravío activo, cargamos SU mensaje para editarlo.
        // Si no, el formulario parte vacío: HU34 dice que nunca se copia un mensaje anterior.
        const actual = lista.find((a) => a.estado === 'Activa');
        if (actual) {
          setMensaje(actual.mensaje);
          setUbicacion(actual.ultima_ubicacion ?? '');
        }
      })
      .catch(manejarError)
      .finally(() => setCargando(false));
  }, [id]);

  async function guardar() {
    if (!mensaje.trim()) {
      setError('Escribe un mensaje para quien encuentre a tu mascota');
      return;
    }
    if (mensaje.length > LARGO_MAXIMO) {
      setError(`El mensaje no puede superar ${LARGO_MAXIMO} caracteres`);
      return;
    }

    setError('');
    setGuardando(true);
    try {
      const cuerpo = { mensaje: mensaje.trim(), ultima_ubicacion: ubicacion.trim() };
      if (activa) {
        // HU34: editar el mensaje del extravío vigente
        await api(`/mascotas/${id}/extravio`, { metodo: 'PATCH', cuerpo });
        Alert.alert('Aviso actualizado', 'El nuevo mensaje ya está visible.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        // HU34: cada reporte crea una alerta nueva
        await api(`/mascotas/${id}/extravio`, { metodo: 'POST', cuerpo });
        Alert.alert(
          'Extravío reportado',
          `Si alguien escanea la medalla de ${nombreMascota}, verá tu mensaje. ¡Esperamos que vuelva pronto!`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardando(false);
    }
  }

  // HU35: marcar como encontrada, con confirmación
  function confirmarEncontrada() {
    Alert.alert(`¿${nombreMascota} ya está contigo?`, 'El aviso de extravío dejará de mostrarse.', [
      { text: 'Todavía no', style: 'cancel' },
      {
        text: 'Sí, la encontré',
        onPress: async () => {
          try {
            const respuesta = await api<{ mensaje: string }>(`/mascotas/${id}/extravio/encontrada`, {
              metodo: 'POST',
            });
            Alert.alert('🎉', respuesta.mensaje, [{ text: 'OK', onPress: () => router.back() }]);
          } catch (e) {
            await manejarError(e);
          }
        },
      },
    ]);
  }

  if (cargando) {
    return <ActivityIndicator size="large" color="#c62828" style={{ marginTop: 40 }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: activa ? 'Aviso de extravío' : 'Reportar extravío' }} />

      <ScrollView contentContainerStyle={estilos.contenedor} keyboardShouldPersistTaps="handled">
        {activa && (
          <View style={estilos.banner}>
            <Text style={estilos.bannerTitulo}>🚨 {nombreMascota} está reportada como extraviada</Text>
            <Text style={estilos.bannerDetalle}>Desde: {fechaHora(activa.fecha_inicio)}</Text>
            {activa.fecha_actualizacion ? (
              <Text style={estilos.bannerDetalle}>
                Mensaje actualizado: {fechaHora(activa.fecha_actualizacion)}
              </Text>
            ) : null}
          </View>
        )}

        <View style={estilos.tarjeta}>
          <Text style={estilos.etiqueta}>Mensaje para quien la encuentre</Text>
          <Text style={estilos.ayuda}>
            Se mostrará en la ficha de emergencia mientras el aviso esté activo.
          </Text>
          <TextInput
            style={[estilos.input, { minHeight: 100, textAlignVertical: 'top' }]}
            placeholder="Ej: Es muy asustadizo, no lo persigas. Llama al número de la ficha."
            value={mensaje}
            onChangeText={setMensaje}
            multiline
            maxLength={LARGO_MAXIMO}
          />
          <Text style={estilos.contador}>
            {mensaje.length}/{LARGO_MAXIMO}
          </Text>

          <Text style={estilos.etiqueta}>Última ubicación (opcional)</Text>
          <TextInput
            style={estilos.input}
            placeholder="Ej: Plaza de Armas, Concepción"
            value={ubicacion}
            onChangeText={setUbicacion}
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
              <Text style={estilos.textoBoton}>{activa ? 'Actualizar aviso' : 'Reportar extravío'}</Text>
            )}
          </Pressable>

          {activa && (
            <Pressable style={estilos.botonEncontrada} onPress={confirmarEncontrada}>
              <Text style={estilos.botonEncontradaTexto}>🏠 ¡La encontré!</Text>
            </Pressable>
          )}
        </View>

        {anteriores.length > 0 && (
          <View style={estilos.tarjeta}>
            <Text style={estilos.etiqueta}>Extravíos anteriores</Text>
            {anteriores.map((a) => (
              <View key={a._id} style={estilos.anterior}>
                <Text style={estilos.anteriorFecha}>
                  {fechaHora(a.fecha_inicio)} → {fechaHora(a.fecha_cierre)}
                </Text>
                <Text style={estilos.anteriorMensaje}>{a.mensaje}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { padding: 16, paddingBottom: 48 },
  banner: { backgroundColor: '#c62828', borderRadius: 12, padding: 16, marginBottom: 16 },
  bannerTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  bannerDetalle: { color: '#ffebee', marginTop: 4 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  etiqueta: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  ayuda: { color: '#777', fontSize: 13, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  contador: { textAlign: 'right', color: '#999', fontSize: 12, marginBottom: 12 },
  error: { color: '#c62828', marginVertical: 8, textAlign: 'center' },
  boton: {
    backgroundColor: '#c62828',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDesactivado: { opacity: 0.6 },
  textoBoton: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botonEncontrada: {
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  botonEncontradaTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  anterior: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, marginTop: 8 },
  anteriorFecha: { color: '#555', fontSize: 13 },
  anteriorMensaje: { color: '#333', marginTop: 2 },
});