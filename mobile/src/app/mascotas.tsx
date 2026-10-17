import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Mascota = {
  _id: string;
  nombre: string;
  especie: string;
  id_raza: { _id: string; nombre: string } | null;
  edad: { anios: number; meses: number } | null;
  peso_actual?: number | null;
  estado_extraviado: boolean;
};

function textoEdad(edad: Mascota['edad']) {
  if (!edad) return '';
  if (edad.anios === 0) return `${edad.meses} ${edad.meses === 1 ? 'mes' : 'meses'}`;
  return `${edad.anios} ${edad.anios === 1 ? 'año' : 'años'}`;
}

export default function Mascotas() {
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setError('');
      const datos = await api<Mascota[]>('/mascotas');
      setMascotas(datos);
    } catch (e) {
      // Token vencido o inválido → volver al login
      if (e instanceof ErrorApi && e.status === 401) {
        await borrarToken();
        router.replace('/login');
        return;
      }
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las mascotas');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

    // Se ejecuta cada vez que la pantalla vuelve a quedar visible (por ejemplo, al volver de crear una mascota)
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  async function cerrarSesion() {
    try {
      await api<unknown>('/auth/logout', { metodo: 'POST' });
    } catch {
      // Si falla (por ejemplo, sin conexión), igual cerramos la sesión en el teléfono
    }
    await borrarToken();
    router.replace('/login');
  }

  return (
    <View style={estilos.contenedor}>
      <Stack.Screen
        options={{
          title: 'Mis mascotas',
          headerBackVisible: false,
          headerRight: () => (
            <Pressable onPress={cerrarSesion} hitSlop={10}>
              <Text style={estilos.salir}>Salir</Text>
            </Pressable>
          ),
        }}
      />

      {cargando ? (
        <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={mascotas}
          keyExtractor={(m) => m._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshing={refrescando}
          onRefresh={() => {
            setRefrescando(true);
            cargar();
          }}
          ListHeaderComponent={error ? <Text style={estilos.error}>{error}</Text> : null}
          ListEmptyComponent={
            !error ? (
              <Text style={estilos.vacio}>Aún no tienes mascotas registradas.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={estilos.tarjeta}
              onPress={() => router.push({ pathname: '/mascota/[id]', params: { id: item._id } })}
            >
              <View style={estilos.filaTitulo}>
                <Text style={estilos.nombre}>{item.nombre}</Text>
                {item.estado_extraviado && <Text style={estilos.extraviada}>Extraviada</Text>}
              </View>
              <Text style={estilos.detalle}>
                {item.especie}
                {item.id_raza ? ` · ${item.id_raza.nombre}` : ''}
              </Text>
              <Text style={estilos.detalle}>
                {textoEdad(item.edad)}
                {item.peso_actual != null ? ` · ${item.peso_actual} kg` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
        <Pressable style={estilos.botonFlotante} onPress={() => router.push('/nueva-mascota')}>
        <Text style={estilos.botonFlotanteTexto}>＋ Agregar mascota</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#f5f5f5' },
  salir: { color: '#c62828', fontSize: 16, fontWeight: '600' },
  tarjeta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nombre: { fontSize: 20, fontWeight: 'bold' },
  extraviada: {
    backgroundColor: '#c62828',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  detalle: { color: '#555', marginTop: 4 },
  vacio: { textAlign: 'center', color: '#777', marginTop: 40 },
  error: { color: '#c62828', textAlign: 'center', marginBottom: 12 },
    botonFlotante: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#2e7d32',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  botonFlotanteTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
});