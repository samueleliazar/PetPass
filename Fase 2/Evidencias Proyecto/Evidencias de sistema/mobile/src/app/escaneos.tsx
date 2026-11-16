import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Alerta = {
  _id: string;
  mensaje: string;
  estado: 'Activa' | 'Cerrada';
  fecha_inicio: string;
  fecha_cierre?: string | null;
};
type Lectura = { _id: string; id_alerta: string | null; fecha_hora: string; canal: 'NFC' | 'QR' };
type Seccion = { titulo: string; subtitulo: string; activa: boolean; data: Lectura[] };

// Fecha y hora en la hora local del teléfono: 20-10-2026 17:40
function fechaHora(iso: string) {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}
function soloFecha(iso: string) {
  return fechaHora(iso).slice(0, 10);
}

export default function Escaneos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
  }

  const cargar = useCallback(() => {
    // Las dos peticiones en paralelo
    Promise.all([
      api<Alerta[]>(`/mascotas/${id}/extravios`),
      api<Lectura[]>(`/mascotas/${id}/lecturas`),
    ])
      .then(([alertas, lecturas]) => {
        // HU36: un grupo por cada extravío (el activo primero, luego del más reciente al más antiguo)
        const ordenadas = [...alertas].sort((a, b) => {
          if (a.estado !== b.estado) return a.estado === 'Activa' ? -1 : 1;
          return b.fecha_inicio.localeCompare(a.fecha_inicio);
        });
        const grupos: Seccion[] = ordenadas.map((a) => ({
          titulo: a.estado === 'Activa' ? '🚨 Extravío actual' : `Extravío del ${soloFecha(a.fecha_inicio)}`,
          subtitulo:
            a.estado === 'Activa'
              ? `Desde el ${fechaHora(a.fecha_inicio)}`
              : `Del ${fechaHora(a.fecha_inicio)} al ${a.fecha_cierre ? fechaHora(a.fecha_cierre) : '—'}`,
          activa: a.estado === 'Activa',
          data: lecturas.filter((l) => l.id_alerta === a._id),
        }));

        // Escaneos ocurridos cuando la mascota NO estaba perdida
        const sinAlerta = lecturas.filter((l) => !l.id_alerta);
        if (sinAlerta.length > 0) {
          grupos.push({
            titulo: 'Fuera de un extravío',
            subtitulo: 'Escaneos mientras la mascota estaba en casa',
            activa: false,
            data: sinAlerta,
          });
        }
        setSecciones(grupos);
      })
      .catch(manejarError);
  }, [id]);
  useFocusEffect(cargar);

  if (!secciones) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <SectionList
      style={estilos.fondo}
      contentContainerStyle={{ padding: 16 }}
      sections={secciones}
      keyExtractor={(l) => l._id}
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={
        <Text style={estilos.vacio}>
          Todavía no hay escaneos. Aparecerán aquí cada vez que alguien abra la ficha de tu mascota.
        </Text>
      }
      renderSectionHeader={({ section }) => (
        <View style={[estilos.cabecera, section.activa && estilos.cabeceraActiva]}>
          <Text style={[estilos.titulo, section.activa && { color: '#c62828' }]}>{section.titulo}</Text>
          <Text style={estilos.subtitulo}>{section.subtitulo}</Text>
          <Text style={estilos.subtitulo}>
            {section.data.length === 0
              ? 'Sin escaneos'
              : `${section.data.length} ${section.data.length === 1 ? 'escaneo' : 'escaneos'}`}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={estilos.fila}>
          <Text style={estilos.icono}>{item.canal === 'QR' ? '📷' : '📶'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={estilos.hora}>{fechaHora(item.fecha_hora)}</Text>
            <Text style={estilos.canal}>{item.canal === 'QR' ? 'Escanearon el QR' : 'Acercaron un teléfono a la medalla (NFC)'}</Text>
          </View>
        </View>
      )}
      renderSectionFooter={() => <View style={{ height: 16 }} />}
    />
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vacio: { textAlign: 'center', color: '#777', marginTop: 40, fontSize: 15, paddingHorizontal: 20 },
  cabecera: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 6 },
  cabeceraActiva: { borderLeftWidth: 6, borderLeftColor: '#c62828' },
  titulo: { fontSize: 17, fontWeight: '700', color: '#222' },
  subtitulo: { fontSize: 13, color: '#777', marginTop: 2 },
  fila: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, padding: 12, marginBottom: 4, marginLeft: 12,
  },
  icono: { fontSize: 22, marginRight: 12 },
  hora: { fontSize: 15, fontWeight: '600', color: '#222' },
  canal: { fontSize: 13, color: '#666' },
});