import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Evento = {
  _id: string;
  tipo_registro: string;
  nombre: string;
  fecha_evento: string;
  dosis?: string;
  descripcion?: string;
  peso_kg?: number;
  veterinario?: { nombre?: string; clinica?: string };
};
type Grupo = { clinica: string; total: number; ultima_atencion: string; eventos: Evento[] };

const SIN_CLINICA = 'Sin clínica registrada';

const ICONOS: Record<string, string> = {
  Vacuna: '💉', Tratamiento: '💊', Receta: '📝', Control: '🩺', Peso: '⚖️',
};

// Las fechas del historial son días: se muestran sin convertir la hora
function fecha(iso: string) {
  return iso.slice(0, 10).split('-').reverse().join('-');
}

export default function PorClinica() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
  }

  const cargar = useCallback(() => {
    api<Grupo[]>(`/mascotas/${id}/eventos/por-clinica`).then(setGrupos).catch(manejarError);
  }, [id]);
  useFocusEffect(cargar);

  if (!grupos) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  const conClinica = grupos.filter((g) => g.clinica !== SIN_CLINICA);

  return (
    <ScrollView style={estilos.fondo} contentContainerStyle={{ padding: 16 }}>
      <Text style={estilos.intro}>
        {conClinica.length === 0
          ? 'Aún no registras la clínica en ninguna atención. Puedes hacerlo al registrar un evento, en el campo del veterinario.'
          : `Tu mascota se ha atendido en ${conClinica.length} ${conClinica.length === 1 ? 'lugar' : 'lugares'}. Toca uno para ver sus atenciones.`}
      </Text>

      {grupos.map((g) => {
        const estaAbierta = abierta === g.clinica;
        const sinClinica = g.clinica === SIN_CLINICA;
        // Nombres de los profesionales que atendieron en esa clínica (sin repetir)
        const veterinarios = [
          ...new Set(g.eventos.map((e) => e.veterinario?.nombre?.trim()).filter(Boolean)),
        ];

        return (
          <View key={g.clinica} style={[estilos.tarjeta, sinClinica && estilos.tarjetaGris]}>
            <Pressable onPress={() => setAbierta(estaAbierta ? null : g.clinica)}>
              <View style={estilos.cabecera}>
                <Text style={estilos.nombreClinica}>
                  {sinClinica ? '❔' : '🏥'} {g.clinica}
                </Text>
                <Text style={estilos.flecha}>{estaAbierta ? '▲' : '▼'}</Text>
              </View>
              <Text style={estilos.resumen}>
                {g.total} {g.total === 1 ? 'atención' : 'atenciones'} · última el {fecha(g.ultima_atencion)}
              </Text>
              {veterinarios.length > 0 && (
                <Text style={estilos.resumen}>👩‍⚕️ {veterinarios.join(', ')}</Text>
              )}
            </Pressable>

            {estaAbierta &&
              g.eventos.map((e) => (
                <View key={e._id} style={estilos.evento}>
                  <Text style={estilos.icono}>{ICONOS[e.tipo_registro] ?? '📋'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.nombreEvento}>
                      {e.tipo_registro === 'Peso' && e.peso_kg != null ? `Peso: ${e.peso_kg} kg` : e.nombre}
                    </Text>
                    <Text style={estilos.detalle}>
                      {e.tipo_registro} · {fecha(e.fecha_evento)}
                      {e.dosis ? ` · ${e.dosis}` : ''}
                    </Text>
                    {e.descripcion ? <Text style={estilos.detalle}>{e.descripcion}</Text> : null}
                  </View>
                </View>
              ))}
          </View>
        );
      })}

      {grupos.length === 0 && <Text style={estilos.vacio}>No hay registros en el historial.</Text>}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { color: '#555', fontSize: 15, marginBottom: 12 },
  vacio: { textAlign: 'center', color: '#777', marginTop: 40, fontSize: 15 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  tarjetaGris: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e0e0e0' },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombreClinica: { fontSize: 17, fontWeight: '700', color: '#222', flex: 1 },
  flecha: { color: '#2e7d32', fontSize: 14, marginLeft: 8 },
  resumen: { fontSize: 14, color: '#666', marginTop: 4 },
  evento: {
    flexDirection: 'row', alignItems: 'flex-start', borderTopWidth: 1,
    borderTopColor: '#eee', paddingTop: 10, marginTop: 10,
  },
  icono: { fontSize: 22, marginRight: 10 },
  nombreEvento: { fontSize: 15, fontWeight: '600', color: '#222' },
  detalle: { fontSize: 13, color: '#666', marginTop: 2 },
});