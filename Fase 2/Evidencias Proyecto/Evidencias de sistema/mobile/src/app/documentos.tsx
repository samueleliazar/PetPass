import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Item = { _id: string; estado: 'Pendiente' | 'Validado'; confianza_ocr: number | null; fecha_carga: string };

function fechaHora(iso: string) {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export default function Documentos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lista, setLista] = useState<Item[] | null>(null);

  const cargar = useCallback(() => {
    api<Item[]>(`/mascotas/${id}/documentos`)
      .then(setLista)
      .catch(async (e) => {
        if (e instanceof ErrorApi && e.status === 401) {
          await borrarToken();
          router.replace('/login');
          return;
        }
        Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
      });
  }, [id]);
  useFocusEffect(cargar);

  if (!lista) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <View style={estilos.fondo}>
      <FlatList
        data={lista}
        keyExtractor={(d) => d._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={estilos.vacio}>Aún no escaneas carnets ni recetas de esta mascota.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={estilos.fila}
            onPress={() => router.push({ pathname: '/documento', params: { id, docId: item._id } })}
          >
            <Text style={estilos.icono}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={estilos.fecha}>{fechaHora(item.fecha_carga)}</Text>
              <Text style={item.estado === 'Pendiente' ? estilos.pendiente : estilos.validado}>
                {item.estado === 'Pendiente' ? '⏳ Pendiente de revisión' : '✅ Validado'}
              </Text>
            </View>
            <Text style={estilos.flecha}>›</Text>
          </Pressable>
        )}
      />
      <Pressable style={estilos.flotante} onPress={() => router.push({ pathname: '/escanear', params: { id } })}>
        <Text style={estilos.textoFlotante}>＋ Escanear carnet</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vacio: { textAlign: 'center', color: '#777', marginTop: 40, fontSize: 15 },
  fila: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  icono: { fontSize: 26, marginRight: 12 },
  fecha: { fontSize: 15, fontWeight: '600', color: '#222' },
  pendiente: { color: '#e65100', marginTop: 2 },
  validado: { color: '#2e7d32', marginTop: 2 },
  flecha: { fontSize: 24, color: '#bbb' },
  flotante: {
    position: 'absolute', right: 16, bottom: 28, backgroundColor: '#2e7d32',
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 28, elevation: 4,
  },
  textoFlotante: { color: '#fff', fontWeight: '700', fontSize: 16 },
});