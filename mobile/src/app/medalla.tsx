import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';
import QRCode from 'react-native-qrcode-svg';

type EstadoMedalla =
  | { activa: false }
  | { activa: true; uuid_placa: string; fecha_vinculacion: string; url_emergencia: string };

function fecha(iso: string) {
  return iso.slice(0, 10).split('-').reverse().join('-');
}

export default function Medalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [estado, setEstado] = useState<EstadoMedalla | null>(null);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
  }

  const cargar = useCallback(() => {
    api<EstadoMedalla>(`/mascotas/${id}/medalla`).then(setEstado).catch(manejarError);
  }, [id]);
  useFocusEffect(cargar);

  async function vincular() {
    if (!codigo.trim()) return Alert.alert('Falta el código', 'Escribe el código impreso en la placa.');
    setOcupado(true);
    try {
      await api(`/mascotas/${id}/medalla`, { metodo: 'POST', cuerpo: { uuid_placa: codigo } });
      setCodigo('');
      cargar();
      Alert.alert('¡Listo!', 'La medalla quedó vinculada.');
    } catch (e) {
      await manejarError(e);
    } finally {
      setOcupado(false);
    }
  }
  async function compartir(url: string) {
    try {
      await Share.share({
        message: `Si encuentras a mi mascota, abre este enlace para ver su ficha de emergencia y contactarme: ${url}`,
      });
    } catch {
      Alert.alert('Error', 'No se pudo abrir el menú para compartir.');
    }
  }

  function confirmarDesvincular() {
    
    // HU19: pide confirmación
    Alert.alert(
      '¿Desvincular la medalla?',
      'Quien la escanee ya no verá los datos de tu mascota. Úsalo si la perdiste o la vas a reemplazar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            setOcupado(true);
            try {
              const r = await api<EstadoMedalla>(`/mascotas/${id}/medalla`, { metodo: 'DELETE' });
              setEstado(r);
            } catch (e) {
              await manejarError(e);
            } finally {
              setOcupado(false);
            }
          },
        },
      ]
    );
  }

  if (!estado) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <ScrollView style={estilos.fondo} contentContainerStyle={{ padding: 16 }}>
      {estado.activa ? (
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>✅ Medalla activa</Text>
          <Text style={estilos.detalle}>Código: {estado.uuid_placa}</Text>
          <Text style={estilos.detalle}>Vinculada el {fecha(estado.fecha_vinculacion)}</Text>
                    {/* HU20: el QR abre la misma ficha, marcando el canal QR */}
          <View style={estilos.qrCaja}>
            <QRCode value={`${estado.url_emergencia}?c=qr`} size={200} />
          </View>
          <Text style={estilos.ayuda}>
            Quien escanee este código con la cámara verá la ficha de emergencia.
          </Text>
          <Pressable
            style={estilos.boton}
            onPress={() => compartir(`${estado.url_emergencia}?c=qr`)}
          >
            <Text style={estilos.textoBoton}>📤 Compartir QR</Text>
          </Pressable>
          <Pressable
            style={[estilos.boton, estilos.botonPeligro, ocupado && { opacity: 0.6 }]}
            onPress={confirmarDesvincular}
            disabled={ocupado}
          >
            <Text style={estilos.textoBoton}>Desvincular medalla</Text>
          </Pressable>
          <Text style={estilos.ayuda}>
            ¿La perdiste o tienes una nueva? Desvincula esta y luego vincula la nueva.
          </Text>
        </View>
      ) : (
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>🏷️ Vincular una medalla</Text>
          <Text style={estilos.detalle}>Escribe el código impreso en la placa (empieza con PP-).</Text>
          <TextInput
            style={estilos.input}
            value={codigo}
            onChangeText={setCodigo}
            placeholder="PP-XXXXXXXXXXXX-XXXXXXXXXXXX"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable
            style={[estilos.boton, ocupado && { opacity: 0.6 }]}
            onPress={vincular}
            disabled={ocupado}
          >
            <Text style={estilos.textoBoton}>{ocupado ? 'Vinculando…' : 'Vincular'}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tarjeta: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  titulo: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#222' },
  detalle: { fontSize: 15, color: '#555', marginBottom: 4 },
  ayuda: { fontSize: 13, color: '#888', marginTop: 10, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12,
    fontSize: 15, marginVertical: 12, fontFamily: 'Courier',
  },
  boton: { backgroundColor: '#2e7d32', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  botonPeligro: { backgroundColor: '#c62828' },
  textoBoton: { color: '#fff', fontWeight: '600', fontSize: 16 },
  qrCaja: { alignItems: 'center', padding: 16, backgroundColor: '#fff', marginTop: 12 },
});