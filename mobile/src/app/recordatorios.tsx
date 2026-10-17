import { useCallback, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Estado = 'Pendiente' | 'Enviado' | 'Realizado' | 'Pospuesto' | 'Cancelado';

type Recordatorio = {
  _id: string;
  id_mascota: { _id: string; nombre: string } | null;
  titulo: string;
  mensaje: string;
  fecha_evento: string;
  fecha_programada: string;
  estado: Estado;
  tipo_recordatorio: 'Vacuna' | 'Medicamento' | 'Tarea General';
};

type RespuestaRealizado = {
  recordatorio: Recordatorio;
  sugerencia_registro: {
    id_mascota: string;
    tipo_registro: string;
    nombre: string;
    fecha_evento: string;
  } | null;
};

const ABIERTOS: Estado[] = ['Pendiente', 'Pospuesto', 'Enviado'];

const COLOR_ESTADO: Record<Estado, string> = {
  Pendiente: '#1565c0',
  Pospuesto: '#ef6c00',
  Enviado: '#6a1b9a',
  Realizado: '#2e7d32',
  Cancelado: '#757575',
};

// Solo la fecha (para dosis guardadas a medianoche UTC): "2027-01-15T00:00:00.000Z" → "15-01-2027"
function soloFecha(iso: string) {
  return iso.slice(0, 10).split('-').reverse().join('-');
}

// Fecha y hora en la zona horaria del teléfono: "15-01-2027 09:00"
function fechaHora(iso: string) {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

// Hoy en formato AAAA-MM-DD, hora local
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Recordatorios() {
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    const mensaje = e instanceof Error ? e.message : 'Ocurrió un error';
    setError(mensaje);
    Alert.alert('Error', mensaje);
  }

  const cargar = useCallback(async () => {
    try {
      setError('');
      const datos = await api<Recordatorio[]>('/recordatorios');
      setRecordatorios(datos);
    } catch (e) {
      await manejarError(e);
    } finally {
      setCargando(false);
    }
  }, []);

  // Recarga cada vez que se vuelve a esta pantalla (por ejemplo, después de crear uno)
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  // ---------- Acciones (HU17) ----------

  async function marcarRealizado(r: Recordatorio) {
    try {
      const respuesta = await api<RespuestaRealizado>(`/recordatorios/${r._id}/realizado`, {
        metodo: 'PATCH',
      });
      await cargar();

      // HU17: al marcar Realizado, se ofrece registrar la dosis aplicada en el historial
      const s = respuesta.sugerencia_registro;
      if (s) {
        Alert.alert(
          '¿Registrar la dosis aplicada?',
          `Se agregará "${s.nombre}" al historial con fecha de hoy.`,
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Sí, registrar',
              onPress: async () => {
                try {
                  await api(`/mascotas/${s.id_mascota}/eventos`, {
                    metodo: 'POST',
                    cuerpo: { tipo_registro: s.tipo_registro, nombre: s.nombre, fecha_evento: hoy() },
                  });
                  Alert.alert('Listo', 'La dosis quedó registrada en el historial.');
                } catch (e) {
                  await manejarError(e);
                }
              },
            },
          ]
        );
      }
    } catch (e) {
      await manejarError(e);
    }
  }

  function posponer(r: Recordatorio) {
    const enDias = async (dias: number) => {
      try {
        const nueva = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
        await api(`/recordatorios/${r._id}/posponer`, {
          metodo: 'PATCH',
          cuerpo: { nueva_fecha: nueva.toISOString() },
        });
        await cargar();
      } catch (e) {
        await manejarError(e);
      }
    };

    // HU17: posponer pide una nueva fecha
    Alert.alert('Posponer recordatorio', '¿Cuándo quieres que te avisemos de nuevo?', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Mañana', onPress: () => enDias(1) },
      { text: 'En una semana', onPress: () => enDias(7) },
    ]);
  }

  function cancelar(r: Recordatorio) {
    Alert.alert('Cancelar recordatorio', `¿Seguro que quieres cancelar "${r.titulo}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/recordatorios/${r._id}/cancelar`, { metodo: 'PATCH' });
            await cargar();
          } catch (e) {
            await manejarError(e);
          }
        },
      },
    ]);
  }

  // ---------- Separar en Próximos e Historial ----------

  const proximos = recordatorios.filter((r) => ABIERTOS.includes(r.estado));
  const historial = recordatorios
    .filter((r) => !ABIERTOS.includes(r.estado))
    .sort((a, b) => b.fecha_programada.localeCompare(a.fecha_programada));

  const secciones = [
    ...(proximos.length ? [{ titulo: 'Próximos', data: proximos }] : []),
    ...(historial.length ? [{ titulo: 'Historial', data: historial }] : []),
  ];

  return (
    <View style={estilos.contenedor}>
      <Stack.Screen
        options={{
          title: 'Recordatorios',
          headerRight: () => (
            <Pressable onPress={() => router.push('/nuevo-recordatorio')} hitSlop={10}>
              <Text style={estilos.botonCabecera}>＋ Nuevo</Text>
            </Pressable>
          ),
        }}
      />

      {cargando ? (
        <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 40 }} />
      ) : (
        <SectionList
          sections={secciones}
          keyExtractor={(r) => r._id}
          contentContainerStyle={{ padding: 16 }}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={error ? <Text style={estilos.error}>{error}</Text> : null}
          ListEmptyComponent={
            <Text style={estilos.vacio}>
              No tienes recordatorios. Se crean solos al registrar una vacuna o un medicamento con
              próxima dosis, o puedes crear uno con "＋ Nuevo".
            </Text>
          }
          renderSectionHeader={({ section }) => (
            <Text style={estilos.seccion}>{section.titulo}</Text>
          )}
          renderItem={({ item }) => {
            const abierto = ABIERTOS.includes(item.estado);
            return (
              <View style={[estilos.tarjeta, !abierto && { opacity: 0.6 }]}>
                <View style={estilos.fila}>
                  <Text style={estilos.titulo}>{item.titulo}</Text>
                  <Text style={[estilos.estado, { backgroundColor: COLOR_ESTADO[item.estado] }]}>
                    {item.estado}
                  </Text>
                </View>

                <Text style={estilos.detalle}>{item.mensaje}</Text>
                {item.id_mascota && (
                  <Text style={estilos.detalle}>
                    🐾 {item.id_mascota.nombre} · {item.tipo_recordatorio}
                  </Text>
                )}
                {item.tipo_recordatorio !== 'Tarea General' && (
                  <Text style={estilos.detalle}>Fecha de la dosis: {soloFecha(item.fecha_evento)}</Text>
                )}
                <Text style={estilos.detalle}>Aviso: {fechaHora(item.fecha_programada)}</Text>

                {abierto && (
                  <View style={estilos.acciones}>
                    <Pressable style={[estilos.accion, estilos.accionPrincipal]} onPress={() => marcarRealizado(item)}>
                      <Text style={estilos.accionPrincipalTexto}>✓ Hecho</Text>
                    </Pressable>
                    <Pressable style={estilos.accion} onPress={() => posponer(item)}>
                      <Text style={estilos.accionTexto}>Posponer</Text>
                    </Pressable>
                    <Pressable style={estilos.accion} onPress={() => cancelar(item)}>
                      <Text style={[estilos.accionTexto, { color: '#c62828' }]}>Cancelar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#f5f5f5' },
  botonCabecera: { color: '#2e7d32', fontSize: 16, fontWeight: '600' },
  seccion: { fontSize: 18, fontWeight: 'bold', marginTop: 8, marginBottom: 8 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 17, fontWeight: '600', flex: 1, marginRight: 8 },
  estado: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  detalle: { color: '#555', marginTop: 4 },
  acciones: { flexDirection: 'row', marginTop: 12 },
  accion: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  accionTexto: { color: '#333', fontWeight: '500' },
  accionPrincipal: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  accionPrincipalTexto: { color: '#fff', fontWeight: '600' },
  vacio: { textAlign: 'center', color: '#777', marginTop: 40, paddingHorizontal: 16 },
  error: { color: '#c62828', textAlign: 'center', marginBottom: 12 },
});