import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api, borrarToken, ErrorApi, subirArchivo } from '../../api';
import { elegirFoto } from '../../elegirFoto';

type Ficha = {
  _id: string;
  nombre: string;
  especie: string;
  id_raza: { _id: string; nombre: string } | null;
  fecha_nacimiento: string;
  edad: { anios: number; meses: number } | null;
  peso_actual?: number | null;
  alergias: string[];
  condiciones_criticas: string[];
  estado_extraviado: boolean;
  foto_temporal?: string | null
};

type Evento = {
  _id: string;
  tipo_registro: string;
  nombre: string;
  fecha_evento: string;
  descripcion?: string;
  dosis?: string;
  veterinario?: { nombre?: string; clinica?: string };
  origen: 'Manual' | 'OCR';
  fecha_proxima_dosis?: string | null;
  peso_kg?: number;
  id_documento?: string | null;
};

const FILTROS = ['Todos', 'Vacuna', 'Tratamiento', 'Receta', 'Peso', 'Control'] as const;
type Filtro = (typeof FILTROS)[number];

const COLOR_TIPO: Record<string, string> = {
  Vacuna: '#1565c0',
  Tratamiento: '#6a1b9a',
  Receta: '#ef6c00',
  Peso: '#2e7d32',
  Control: '#00838f',
};

// "2026-09-20T00:00:00.000Z" → "20-09-2026" (sin problemas de zona horaria)
function fecha(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10).split('-').reverse().join('-');
}

function textoEdad(edad: Ficha['edad']) {
  if (!edad) return '';
  if (edad.anios === 0) return `${edad.meses} ${edad.meses === 1 ? 'mes' : 'meses'}`;
  return `${edad.anios} ${edad.anios === 1 ? 'año' : 'años'}${edad.meses ? ` y ${edad.meses} ${edad.meses === 1 ? 'mes' : 'meses'}` : ''}`;
}

export default function FichaMascota() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [cargando, setCargando] = useState(true);
  const [cargandoEventos, setCargandoEventos] = useState(false);
  const [error, setError] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
    // Cada vez que la pantalla vuelve a verse (por ejemplo, después de registrar algo), recargamos
  const [recarga, setRecarga] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRecarga((r) => r + 1);
    }, [])
  );

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    setError(e instanceof Error ? e.message : 'Ocurrió un error');
  }

  // Datos de la ficha (una vez)
  useEffect(() => {
    api<Ficha>(`/mascotas/${id}`)
      .then(setFicha)
      .catch(manejarError)
      .finally(() => setCargando(false));
  }, [id]);

  // Historial (cada vez que cambia el filtro) → usa el filtro del backend (HU09)
  useEffect(() => {
    setCargandoEventos(true);
    const consulta = filtro === 'Todos' ? '' : `?tipo=${filtro}`;
    api<{ total: number; eventos: Evento[] }>(`/mascotas/${id}/eventos${consulta}`)
      .then((r) => setEventos(r.eventos))
      .catch(manejarError)
      .finally(() => setCargandoEventos(false));
  }, [id, filtro]);

  if (cargando) {
    return <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 40 }} />;
  }

  if (!ficha) {
    return <Text style={estilos.error}>{error || 'No se encontró la mascota'}</Text>;
  }

  const tieneAlertas = ficha.alergias.length > 0 || ficha.condiciones_criticas.length > 0;
 // HU05 / HU21: foto de perfil
  async function subirFoto(origen: 'camara' | 'galeria') {
    const uri = await elegirFoto(origen, { anchoMaximo: 800, cuadrada: true });
    if (!uri) return;
    setSubiendoFoto(true);
    try {
      const r = await subirArchivo<{ foto_temporal: string }>(`/mascotas/${id}/foto`, 'imagen', {
        uri,
        nombre: 'perfil.jpg',
        tipo: 'image/jpeg',
      });
      setFicha((f) => (f ? { ...f, foto_temporal: r.foto_temporal } : f));
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) return manejarError(e);
      Alert.alert('No se pudo subir la foto', e instanceof Error ? e.message : 'Intenta de nuevo');
    } finally {
      setSubiendoFoto(false);
    }
  }

  function cambiarFoto() {
    Alert.alert(`Foto de ${ficha!.nombre}`, undefined, [
      { text: '📷 Tomar foto', onPress: () => subirFoto('camara') },
      { text: '🖼️ Elegir de la galería', onPress: () => subirFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }
  return (
    <View style={estilos.contenedor}>
      <Stack.Screen
        options={{
          title: ficha.nombre,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/editar-mascota', params: { id: ficha._id } })}
              hitSlop={10}
            >
              <Text style={{ color: '#2e7d32', fontSize: 16, fontWeight: '600' }}>Editar</Text>
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={eventos}
        keyExtractor={(e) => e._id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View>
            {ficha.estado_extraviado && (
              <Pressable
                style={estilos.bannerExtravio}
                onPress={() => router.push({ pathname: '/extravio', params: { id: ficha._id } })}
              >
                <Text style={estilos.bannerTexto}>🚨 Reportada como extraviada</Text>
                <Text style={estilos.bannerSubtexto}>Toca para ver o editar el aviso</Text>
              </Pressable>
            )}

            {/* Datos generales */}
            <View style={estilos.tarjeta}>
                            <Pressable onPress={cambiarFoto} disabled={subiendoFoto} style={estilos.fotoCaja}>
                {subiendoFoto ? (
                  <ActivityIndicator color="#2e7d32" />
                ) : ficha.foto_temporal ? (
                  <Image source={{ uri: ficha.foto_temporal }} style={estilos.foto} />
                ) : (
                  <Text style={{ fontSize: 48 }}>🐾</Text>
                )}
              </Pressable>
              <Text style={estilos.cambiarFoto}>
                {ficha.foto_temporal ? 'Cambiar foto' : 'Agregar foto'}
              </Text>
              <Text style={estilos.detalle}>
                {ficha.especie}
                {ficha.id_raza ? ` · ${ficha.id_raza.nombre}` : ''}
              </Text>
              <Text style={estilos.detalle}>
                {textoEdad(ficha.edad)} · nació el {fecha(ficha.fecha_nacimiento)}
              </Text>
              {ficha.peso_actual != null && (
                <Text style={estilos.detalle}>Peso actual: {ficha.peso_actual} kg</Text>
              )}
            </View>
            
            {!ficha.estado_extraviado && (
              <Pressable
                style={estilos.botonReportar}
                onPress={() => router.push({ pathname: '/extravio', params: { id: ficha._id } })}
              >
                <Text style={estilos.botonReportarTexto}>🚨 Reportar extravío</Text>
              </Pressable>
            )}
            <Pressable
              style={estilos.botonPrivacidad}
              onPress={() => router.push({ pathname: '/privacidad', params: { id: ficha._id } })}
            >
              <Text style={estilos.textoPrivacidad}>🔒 Privacidad de la ficha pública</Text>
            </Pressable>
            <Pressable
              style={estilos.botonPrivacidad}
              onPress={() => router.push({ pathname: '/medalla', params: { id: ficha._id } })}
            >
              <Text style={estilos.textoPrivacidad}>🏷️ Medalla</Text>
            </Pressable>
            <Pressable
              style={estilos.botonPrivacidad}
              onPress={() => router.push({ pathname: '/escaneos', params: { id: ficha._id } })}
            >
              <Text style={estilos.textoPrivacidad}>📡 Escaneos de la medalla</Text>
            </Pressable>
            <Pressable
              style={estilos.botonPrivacidad}
              onPress={() => router.push({ pathname: '/por-clinica', params: { id: ficha._id } })}
            >
              <Text style={estilos.textoPrivacidad}>🏥 Historial por clínica</Text>
            </Pressable>
            <Pressable
              style={estilos.botonPrivacidad}
              onPress={() => router.push({ pathname: '/documentos', params: { id: ficha._id } })}
            >
              <Text style={estilos.textoPrivacidad}>📄 Carnets y documentos</Text>
            </Pressable>
  
            {/* HU08: alergias y condiciones críticas, destacadas */}
            {tieneAlertas ? (
              <View style={estilos.tarjetaAlerta}>
                {ficha.condiciones_criticas.length > 0 && (
                  <>
                    <Text style={estilos.tituloAlerta}>⚠️ Condiciones críticas</Text>
                    {ficha.condiciones_criticas.map((c) => (
                      <Text key={c} style={estilos.itemAlerta}>• {c}</Text>
                    ))}
                  </>
                )}
                {ficha.alergias.length > 0 && (
                  <>
                    <Text style={[estilos.tituloAlerta, { marginTop: 8 }]}>Alergias</Text>
                    {ficha.alergias.map((a) => (
                      <Text key={a} style={estilos.itemAlerta}>• {a}</Text>
                    ))}
                  </>
                )}
              </View>
            ) : (
              <Text style={estilos.sinAlertas}>Sin alergias ni condiciones críticas registradas</Text>
            )}

            {/* HU09: filtros del historial */}
              <View style={estilos.filaSeccion}>
                <Text style={estilos.seccion}>Historial clínico</Text>
                <Pressable
                  onPress={() => router.push({ pathname: '/nuevo-evento', params: { id: ficha._id } })}
                  style={estilos.botonRegistrar}
                >
                  <Text style={estilos.botonRegistrarTexto}>＋ Registrar</Text>
                </Pressable>
              </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {FILTROS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFiltro(f)}
                  style={[estilos.chip, filtro === f && estilos.chipActivo]}
                >
                  <Text style={[estilos.chipTexto, filtro === f && estilos.chipTextoActivo]}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {cargandoEventos && <ActivityIndicator color="#2e7d32" style={{ marginBottom: 12 }} />}
            {error ? <Text style={estilos.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          !cargandoEventos ? (
            <Text style={estilos.vacio}>
              No hay registros{filtro !== 'Todos' ? ` de tipo ${filtro}` : ''}.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={estilos.tarjeta}>
            <View style={estilos.filaTitulo}>
              <Text style={[estilos.tipo, { backgroundColor: COLOR_TIPO[item.tipo_registro] ?? '#555' }]}>
                {item.tipo_registro}
              </Text>
              {/* HU09: origen del registro */}
              <Text style={estilos.origen}>{item.origen}</Text>
            </View>

            <Text style={estilos.nombreEvento}>{item.nombre}</Text>
            <Text style={estilos.detalle}>{fecha(item.fecha_evento)}</Text>

            {item.peso_kg != null && <Text style={estilos.detalle}>{item.peso_kg} kg</Text>}
            {item.dosis ? <Text style={estilos.detalle}>Dosis: {item.dosis}</Text> : null}
            {item.descripcion ? <Text style={estilos.detalle}>{item.descripcion}</Text> : null}
            {item.veterinario?.nombre || item.veterinario?.clinica ? (
              <Text style={estilos.detalle}>
                {[item.veterinario?.nombre, item.veterinario?.clinica].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {item.fecha_proxima_dosis ? (
              <Text style={estilos.proxima}>Próxima dosis: {fecha(item.fecha_proxima_dosis)}</Text>
            ) : null}

            {/* HU13: desde un registro del OCR se abre la foto original */}
            {item.id_documento ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/documento',
                    params: { id: ficha._id, docId: item.id_documento! },
                  })
                }
                hitSlop={8}
              >
                <Text style={estilos.verOriginal}>📄 Ver original</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#f5f5f5' },
  tarjeta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  detalle: { color: '#555', marginTop: 4 },
  bannerExtravio: { backgroundColor: '#c62828', borderRadius: 12, padding: 12, marginBottom: 12 },
  bannerTexto: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  tarjetaAlerta: {
    backgroundColor: '#fff3e0',
    borderLeftWidth: 5,
    borderLeftColor: '#e65100',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tituloAlerta: { fontWeight: 'bold', color: '#e65100', fontSize: 16 },
  itemAlerta: { color: '#4e342e', marginTop: 4, fontSize: 15 },
  sinAlertas: { color: '#777', marginBottom: 12, textAlign: 'center' },
  seccion: { fontSize: 18, fontWeight: 'bold', marginTop: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipActivo: { backgroundColor: '#2e7d32' },
  chipTexto: { color: '#2e7d32' },
  chipTextoActivo: { color: '#fff' },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipo: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  origen: { fontSize: 12, color: '#777' },
  nombreEvento: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  proxima: { color: '#1565c0', marginTop: 6, fontWeight: '500' },
  vacio: { textAlign: 'center', color: '#777', marginTop: 20 },
  error: { color: '#c62828', textAlign: 'center', margin: 16 },
    filaSeccion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  botonRegistrar: { backgroundColor: '#2e7d32', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  botonRegistrarTexto: { color: '#fff', fontWeight: '600' },
    bannerSubtexto: { color: '#ffebee', textAlign: 'center', marginTop: 4, fontSize: 13 },
  botonReportar: {
    borderWidth: 1,
    borderColor: '#c62828',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  botonReportarTexto: { color: '#c62828', fontWeight: '600', fontSize: 15 },
  botonPrivacidad: {
  borderWidth: 1, borderColor: '#2e7d32', borderRadius: 12,
  padding: 12, alignItems: 'center', marginBottom: 12, backgroundColor: '#fff',
},
textoPrivacidad: { color: '#2e7d32', fontWeight: '600', fontSize: 16 },
verOriginal: { color: '#2e7d32', fontWeight: '600', marginTop: 8 },
  fotoCaja: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#e8f5e9',
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  foto: { width: 110, height: 110 },
  cambiarFoto: { color: '#2e7d32', textAlign: 'center', fontWeight: '600', marginTop: 6, marginBottom: 6 },
});