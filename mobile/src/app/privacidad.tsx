import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Visibilidad = { telefono: boolean; alergias: boolean; tratamientos: boolean; vacunas: boolean };

const OPCIONES: { campo: keyof Visibilidad; titulo: string; detalle: string }[] = [
  { campo: 'telefono', titulo: '📞 Teléfonos de contacto', detalle: 'Muestra el botón para llamarte (y a tu contacto alterno).' },
  { campo: 'alergias', titulo: '⚠️ Alergias', detalle: 'Útil si quien la encuentra le da comida o la lleva al veterinario.' },
  { campo: 'tratamientos', titulo: '💊 Tratamientos y recetas', detalle: 'Los 5 más recientes, con su dosis.' },
  { campo: 'vacunas', titulo: '💉 Vacunas', detalle: 'Las 5 más recientes, con su fecha.' },
];

export default function Privacidad() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vis, setVis] = useState<Visibilidad | null>(null);
  const [guardando, setGuardando] = useState<keyof Visibilidad | null>(null);

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
  }

  useEffect(() => {
    api<Visibilidad>(`/mascotas/${id}/privacidad`).then(setVis).catch(manejarError);
  }, [id]);

  async function cambiar(campo: keyof Visibilidad, valor: boolean) {
    if (!vis) return;
    const anterior = vis;
    setVis({ ...vis, [campo]: valor }); // se mueve al tiro; si falla, vuelve atrás
    setGuardando(campo);
    try {
      const nueva = await api<Visibilidad>(`/mascotas/${id}/privacidad`, {
        metodo: 'PATCH',
        cuerpo: { [campo]: valor },
      });
      setVis(nueva);
    } catch (e) {
      setVis(anterior);
      await manejarError(e);
    } finally {
      setGuardando(null);
    }
  }

  if (!vis) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.fondo} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.intro}>
        Elige qué verá quien escanee la medalla de tu mascota. Los cambios se guardan al instante.
      </Text>

      <View style={styles.tarjeta}>
        {OPCIONES.map((op, i) => (
          <View key={op.campo} style={[styles.fila, i > 0 && styles.separador]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.titulo}>{op.titulo}</Text>
              <Text style={styles.detalle}>{op.detalle}</Text>
            </View>
            {guardando === op.campo ? (
              <ActivityIndicator color="#2e7d32" />
            ) : (
              <Switch
                value={vis[op.campo]}
                onValueChange={(v) => cambiar(op.campo, v)}
                disabled={guardando !== null}
                trackColor={{ true: '#81c784', false: '#ccc' }}
                thumbColor={vis[op.campo] ? '#2e7d32' : '#f4f4f4'}
              />
            )}
          </View>
        ))}
      </View>

      {!vis.telefono && (
        <Text style={styles.advertencia}>
          Sin teléfono visible, quien encuentre a tu mascota no podrá llamarte desde la ficha.
        </Text>
      )}

      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Siempre visibles</Text>
        <Text style={styles.detalle}>Nombre, especie, raza, edad, condiciones críticas y el aviso de extravío.</Text>
        <Text style={[styles.titulo, { marginTop: 12 }]}>Nunca visibles</Text>
        <Text style={styles.detalle}>Tu correo y los documentos escaneados.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { color: '#555', fontSize: 15, marginBottom: 12 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  separador: { borderTopWidth: 1, borderTopColor: '#eee' },
  titulo: { fontSize: 16, fontWeight: '600', color: '#222' },
  detalle: { fontSize: 13, color: '#777', marginTop: 2 },
  advertencia: { color: '#c62828', marginBottom: 14, fontSize: 14 },
});