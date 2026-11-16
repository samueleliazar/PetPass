import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { borrarToken, ErrorApi, subirArchivo } from '../api';

export default function Escanear() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [foto, setFoto] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  // JPG y máximo 1600 px de ancho: sube más rápido, y Vision lo lee igual de bien
  async function prepararFoto(asset: ImagePicker.ImagePickerAsset) {
    const acciones = asset.width > 1600 ? [{ resize: { width: 1600 } }] : [];
    const r = await manipulateAsync(asset.uri, acciones, { compress: 0.8, format: SaveFormat.JPEG });
    setFoto(r.uri);
  }

  // HU10: pide permiso de cámara
  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        'Permiso de cámara',
        'Para fotografiar el carnet, permite el acceso a la cámara en los Ajustes del teléfono.'
      );
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled) await prepararFoto(r.assets[0]);
  }

  async function elegirDeGaleria() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled) await prepararFoto(r.assets[0]);
  }

  async function enviar() {
    if (!foto) return;
    setProcesando(true);
    try {
      const doc = await subirArchivo<{ _id: string }>(`/mascotas/${id}/documentos`, 'imagen', {
        uri: foto,
        nombre: 'carnet.jpg',
        tipo: 'image/jpeg',
      });
      // Va directo a revisar el texto leído (HU12)
      router.replace({ pathname: '/documento', params: { id, docId: doc._id } });
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) {
        await borrarToken();
        router.replace('/login');
        return;
      }
      Alert.alert('No se pudo leer el carnet', e instanceof Error ? e.message : 'Intenta de nuevo');
      setProcesando(false);
    }
  }

  // HU11: indicador visible mientras se procesa
  if (procesando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={estilos.procesando}>Leyendo el carnet…</Text>
        <Text style={estilos.ayuda}>Esto puede tardar unos segundos.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={estilos.fondo} contentContainerStyle={{ padding: 16 }}>
      {foto ? (
        // HU10: vista previa antes de enviar
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>¿Se lee bien?</Text>
          <Image source={{ uri: foto }} style={estilos.vista} resizeMode="contain" />
          <Text style={estilos.ayuda}>
            Revisa que el texto esté enfocado y sin reflejos. Si no, toma otra.
          </Text>
          <Pressable style={estilos.boton} onPress={enviar}>
            <Text style={estilos.textoBoton}>Enviar</Text>
          </Pressable>
          <Pressable style={[estilos.boton, estilos.secundario]} onPress={() => setFoto(null)}>
            <Text style={[estilos.textoBoton, { color: '#2e7d32' }]}>Otra foto</Text>
          </Pressable>
        </View>
      ) : (
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>📄 Escanear carnet o receta</Text>
          <Text style={estilos.ayuda}>
            Pon el documento sobre una mesa, con buena luz, y que se vea completo.
          </Text>
          <Pressable style={estilos.boton} onPress={tomarFoto}>
            <Text style={estilos.textoBoton}>📷 Tomar foto</Text>
          </Pressable>
          <Pressable style={[estilos.boton, estilos.secundario]} onPress={elegirDeGaleria}>
            <Text style={[estilos.textoBoton, { color: '#2e7d32' }]}>🖼️ Elegir de la galería</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  procesando: { fontSize: 18, fontWeight: '600', marginTop: 16, color: '#222' },
  tarjeta: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  titulo: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 8 },
  ayuda: { fontSize: 14, color: '#777', marginVertical: 6, textAlign: 'center' },
  vista: { width: '100%', height: 380, borderRadius: 10, backgroundColor: '#eee', marginVertical: 8 },
  boton: { backgroundColor: '#2e7d32', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  secundario: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#2e7d32' },
  textoBoton: { color: '#fff', fontWeight: '600', fontSize: 16 },
});