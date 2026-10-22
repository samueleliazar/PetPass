import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Doc = {
  _id: string;
  estado: 'Pendiente' | 'Validado';
  texto_ocr_raw: string;
  texto_validado: string | null;
  confianza_ocr: number | null;
  fecha_carga: string;
  imagen_temporal?: string;
};

export default function Documento() {
  const { id, docId } = useLocalSearchParams<{ id: string; docId: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [texto, setTexto] = useState('');
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
    api<Doc>(`/mascotas/${id}/documentos/${docId}`)
      .then((d) => {
        setDoc(d);
        setTexto(d.texto_validado ?? d.texto_ocr_raw);
      })
      .catch(manejarError);
  }, [id, docId]);

  // HU12: nada se guarda en el historial; solo se confirma el texto
  function confirmar() {
    if (!texto.trim()) return Alert.alert('Falta el texto', 'El texto no puede quedar vacío.');
    Alert.alert('¿Confirmar el texto?', 'Después ya no podrás editarlo.', [
      { text: 'Seguir revisando', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          setGuardando(true);
          try {
            const r = await api<Doc>(`/mascotas/${id}/documentos/${docId}/validar`, {
              metodo: 'PATCH',
              cuerpo: { texto_validado: texto },
            });
            setDoc((anterior) => ({ ...anterior!, ...r }));
          } catch (e) {
            await manejarError(e);
          } finally {
            setGuardando(false);
          }
        },
      },
    ]);
  }

  if (!doc) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  const confianza = doc.confianza_ocr != null ? Math.round(doc.confianza_ocr * 100) : null;
  const pendiente = doc.estado === 'Pendiente';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={estilos.fondo} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {/* HU13: la foto original, de solo lectura */}
        {doc.imagen_temporal && (
          <Pressable onPress={() => Linking.openURL(doc.imagen_temporal!)}>
            <Image source={{ uri: doc.imagen_temporal }} style={estilos.foto} resizeMode="contain" />
            <Text style={estilos.ayuda}>Toca la foto para verla en grande</Text>
          </Pressable>
        )}

        <View style={[estilos.estado, pendiente ? estilos.estadoPendiente : estilos.estadoValidado]}>
          <Text style={estilos.textoEstado}>
            {pendiente ? '⏳ Pendiente de revisión' : '✅ Validado'}
            {confianza != null ? `  ·  lectura ${confianza} % segura` : ''}
          </Text>
        </View>

        {pendiente && confianza != null && confianza < 75 && (
          <Text style={estilos.aviso}>
            La lectura salió poco segura: revisa el texto con cuidado o toma una foto con más luz.
          </Text>
        )}

        <Text style={estilos.etiqueta}>
          {pendiente ? 'Corrige lo que se haya leído mal:' : 'Texto confirmado:'}
        </Text>
        <TextInput
          style={[estilos.texto, !pendiente && estilos.textoBloqueado]}
          value={texto}
          onChangeText={setTexto}
          multiline
          editable={pendiente}
          textAlignVertical="top"
          placeholder="No se encontró texto en la foto."
        />

        {pendiente ? (
          <Pressable
            style={[estilos.boton, guardando && { opacity: 0.6 }]}
            onPress={confirmar}
            disabled={guardando}
          >
            <Text style={estilos.textoBoton}>{guardando ? 'Guardando…' : 'Confirmar texto'}</Text>
          </Pressable>
        ) : (
          <Text style={estilos.ayuda}>
            Próximamente podrás convertir este texto en vacunas y tratamientos del historial.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  foto: { width: '100%', height: 260, borderRadius: 12, backgroundColor: '#e0e0e0' },
  ayuda: { fontSize: 13, color: '#888', textAlign: 'center', marginVertical: 6 },
  estado: { borderRadius: 10, padding: 10, marginVertical: 10 },
  estadoPendiente: { backgroundColor: '#fff8e1' },
  estadoValidado: { backgroundColor: '#e8f5e9' },
  textoEstado: { fontWeight: '600', color: '#333', textAlign: 'center' },
  aviso: { color: '#e65100', marginBottom: 8, fontSize: 14 },
  etiqueta: { fontWeight: '600', fontSize: 15, marginBottom: 6, color: '#222' },
  texto: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 10,
    padding: 12, fontSize: 15, minHeight: 220,
  },
  textoBloqueado: { backgroundColor: '#fafafa', color: '#555' },
  boton: { backgroundColor: '#2e7d32', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  textoBoton: { color: '#fff', fontWeight: '600', fontSize: 16 },
});