import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';
import QRCode from 'react-native-qrcode-svg';
import { cancelarNfc, grabarUrl, leerUid, nfcActivado, nfcDisponible } from '../nfc';

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
  // HU18 / HU21: NFC (solo Android con el development build)
  const [nfcOk, setNfcOk] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [esperandoChip, setEsperandoChip] = useState<'leer' | 'grabar' | null>(null);
  // Recuerda si el usuario presionó "Cancelar" (para no mostrar un aviso de error en ese caso)
  const cancelado = useRef(false);

  useEffect(() => {
    nfcDisponible().then(setNfcOk);
  }, []);

  async function revisarNfcEncendido() {
    if (await nfcActivado()) return true;
    Alert.alert('NFC apagado', 'Activa el NFC en Ajustes del teléfono (Conexiones → NFC) e intenta de nuevo.');
    return false;
  }

  async function leerChip() {
    if (!(await revisarNfcEncendido())) return;
    cancelado.current = false;
    setEsperandoChip('leer');
    try {
      setUid(await leerUid());
    } catch {
      if (!cancelado.current) {
        Alert.alert('No se pudo leer el chip', 'Mantén el teléfono quieto sobre el sticker e intenta de nuevo.');
      }
    } finally {
      setEsperandoChip(null);
    }
  }

  async function grabarChip(url: string) {
    // Las medallas deben llevar la dirección pública (Cloud Run), nunca la de un PC o un túnel
    if (!url.includes('.run.app/')) {
      Alert.alert(
        'Servidor local',
        'La app está conectada a un servidor de pruebas. Para grabar medallas, cambia mobile/.env al servidor publicado (Cloud Run).'
      );
      return;
    }
    if (!(await revisarNfcEncendido())) return;
    cancelado.current = false;
    setEsperandoChip('grabar');
    try {
      await grabarUrl(url);
      Alert.alert('¡Listo!', 'El chip ya abre la ficha de emergencia. Pruébalo acercando otro teléfono con NFC.');
    } catch {
      if (!cancelado.current) {
        Alert.alert('No se pudo grabar', 'Mantén el teléfono quieto sobre el sticker unos segundos e intenta de nuevo.');
      }
    } finally {
      setEsperandoChip(null);
    }
  }

  function cancelarEspera() {
    cancelado.current = true;
    cancelarNfc();
  }


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
      await api(`/mascotas/${id}/medalla`, {
        metodo: 'POST',
        cuerpo: { uuid_placa: codigo, ...(uid ? { uid_nfc: uid } : {}) },
      });
      setUid(null);
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
if (esperandoChip) {
    return (
      <View style={estilos.centro}>
        <Text style={{ fontSize: 56 }}>📶</Text>
        <Text style={estilos.titulo}>Acerca el teléfono al chip</Text>
        <Text style={estilos.ayuda}>
          {esperandoChip === 'leer'
            ? 'Apoya la parte de atrás del teléfono sobre el sticker NFC.'
            : 'Mantén el teléfono quieto sobre el sticker mientras se graba el enlace.'}
        </Text>
        <Pressable style={[estilos.boton, estilos.botonPeligro, { paddingHorizontal: 40 }]} onPress={cancelarEspera}>
          <Text style={estilos.textoBoton}>Cancelar</Text>
        </Pressable>
      </View>
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
                    {nfcOk && (
            <Pressable
              style={[estilos.boton, estilos.botonNfc]}
              onPress={() => grabarChip(estado.url_emergencia)}
              disabled={ocupado}
            >
              <Text style={estilos.textoBoton}>📶 Grabar enlace en el chip</Text>
            </Pressable>
          )}
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
            {nfcOk && (
            <Pressable style={[estilos.boton, estilos.botonNfc]} onPress={leerChip} disabled={ocupado}>
              <Text style={estilos.textoBoton}>
                {uid ? `📶 Chip leído: ${uid}` : '📶 Leer chip NFC (opcional)'}
              </Text>
            </Pressable>
          )}
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
    botonNfc: { backgroundColor: '#1565c0' },
});