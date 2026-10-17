import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { api, borrarToken, ErrorApi } from '../api';

type Perfil = {
  nombre_completo: string;
  email: string;
  telefono: string;
  contacto_alterno?: string;
};

const FORMATO_TELEFONO = /^\+?\d{8,15}$/;

export default function PantallaPerfil() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [telefono, setTelefono] = useState('');
  const [contactoAlterno, setContactoAlterno] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function manejarError(e: unknown) {
    if (e instanceof ErrorApi && e.status === 401) {
      await borrarToken();
      router.replace('/login');
      return;
    }
    setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado');
  }

  useEffect(() => {
    api<Perfil>('/auth/perfil')
      .then((datos) => {
        setPerfil(datos);
        setTelefono(datos.telefono);
        setContactoAlterno(datos.contacto_alterno ?? '');
      })
      .catch(manejarError)
      .finally(() => setCargando(false));
  }, []);

  async function guardar() {
    // Quitamos espacios: "+569 1234 5678" → "+56912345678"
    const tel = telefono.replace(/\s/g, '');
    const alterno = contactoAlterno.replace(/\s/g, '');

    // HU04: validación de formato telefónico
    if (!FORMATO_TELEFONO.test(tel)) {
      setError('El teléfono no es válido (ejemplo: +56912345678)');
      return;
    }
    if (alterno && !FORMATO_TELEFONO.test(alterno)) {
      setError('El contacto alterno no es válido (ejemplo: +56987654321)');
      return;
    }
    if (alterno && alterno === tel) {
      setError('El contacto alterno debe ser distinto de tu teléfono');
      return;
    }

    setError('');
    setGuardando(true);
    try {
      // contacto_alterno vacío = quitarlo (el backend lo borra)
      const actualizado = await api<Perfil>('/auth/perfil', {
        metodo: 'PATCH',
        cuerpo: { telefono: tel, contacto_alterno: alterno },
      });
      // HU04: el cambio se refleja de inmediato
      setPerfil(actualizado);
      setTelefono(actualizado.telefono);
      setContactoAlterno(actualizado.contacto_alterno ?? '');
      Alert.alert('Datos actualizados', 'Tus datos de contacto quedaron guardados.');
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardando(false);
    }
  }

  async function cerrarSesion() {
    try {
      await api<unknown>('/auth/logout', { metodo: 'POST' });
    } catch {
      // Si falla (por ejemplo, sin conexión), igual cerramos la sesión en el teléfono
    }
    await borrarToken();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/login');
  }

  if (cargando) {
    return <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 40 }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Mi perfil' }} />

      <ScrollView contentContainerStyle={estilos.contenedor} keyboardShouldPersistTaps="handled">
        {perfil && (
          <View style={estilos.tarjeta}>
            <Text style={estilos.nombre}>{perfil.nombre_completo}</Text>
            <Text style={estilos.detalle}>{perfil.email}</Text>
          </View>
        )}

        <View style={estilos.tarjeta}>
          <Text style={estilos.tituloSeccion}>Datos de contacto</Text>
          <Text style={estilos.ayuda}>
            Si alguien encuentra a tu mascota, podrá llamarte a estos números desde su ficha de
            emergencia (solo si tienes el teléfono visible).
          </Text>

          <Text style={estilos.etiqueta}>Teléfono</Text>
          <TextInput
            style={estilos.input}
            placeholder="+56912345678"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
          />

          <Text style={estilos.etiqueta}>Contacto alterno (opcional)</Text>
          <TextInput
            style={estilos.input}
            placeholder="Otro número, por si no contestas"
            value={contactoAlterno}
            onChangeText={setContactoAlterno}
            keyboardType="phone-pad"
          />
          <Text style={estilos.ayudaChica}>Déjalo vacío para quitarlo.</Text>

          {error ? <Text style={estilos.error}>{error}</Text> : null}

          <Pressable
            style={[estilos.boton, guardando && estilos.botonDesactivado]}
            onPress={guardar}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={estilos.textoBoton}>Guardar</Text>
            )}
          </Pressable>
        </View>

        <Pressable style={estilos.botonSalir} onPress={cerrarSesion}>
          <Text style={estilos.botonSalirTexto}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { padding: 16, paddingBottom: 48 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  nombre: { fontSize: 20, fontWeight: 'bold' },
  detalle: { color: '#555', marginTop: 4 },
  tituloSeccion: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  ayuda: { color: '#777', marginBottom: 16, fontSize: 13 },
  ayudaChica: { color: '#999', fontSize: 12, marginTop: -8, marginBottom: 16 },
  etiqueta: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  error: { color: '#c62828', marginBottom: 12, textAlign: 'center' },
  boton: { backgroundColor: '#2e7d32', padding: 16, borderRadius: 10, alignItems: 'center' },
  botonDesactivado: { opacity: 0.6 },
  textoBoton: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botonSalir: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c62828',
    backgroundColor: '#fff',
  },
  botonSalirTexto: { color: '#c62828', fontSize: 16, fontWeight: '600' },
});