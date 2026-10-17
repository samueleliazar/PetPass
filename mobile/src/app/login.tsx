import { useState } from 'react';
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { api, guardarToken } from '../api';

type RespuestaLogin = {
  token: string;
  tutor: { id: string; nombre_completo: string; email: string };
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function iniciarSesion() {
    setError('');
    setCargando(true);
    try {
      const respuesta = await api<RespuestaLogin>('/auth/login', {
        metodo: 'POST',
        cuerpo: { email: email.trim(), password },
      });
      await guardarToken(respuesta.token);
      router.replace('/mascotas'); // replace: no se puede "volver atrás" al login
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado');
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <Text style={estilos.titulo}>PetPass</Text>
      <Text style={estilos.subtitulo}>La ficha médica de tu mascota</Text>

      <TextInput
        style={estilos.input}
        placeholder="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={estilos.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Pressable
        style={[estilos.boton, cargando && estilos.botonDesactivado]}
        onPress={iniciarSesion}
        disabled={cargando}
      >
        {cargando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={estilos.textoBoton}>Iniciar sesión</Text>
        )}
      </Pressable>
      <Pressable onPress={() => router.push('/registro')} style={{ marginTop: 20 }}>
                      <Text style={estilos.enlace}>
                          ¿No tienes cuenta? <Text style={{ fontWeight: 'bold' }}>Crear una</Text>
                      </Text>
              </Pressable>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  titulo: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitulo: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: '#c62828', marginBottom: 12, textAlign: 'center' },
  boton: { backgroundColor: '#2e7d32', padding: 16, borderRadius: 10, alignItems: 'center' },
  botonDesactivado: { opacity: 0.6 },
  textoBoton: { color: '#fff', fontSize: 16, fontWeight: '600' },
  enlace: { textAlign: 'center', color: '#2e7d32', fontSize: 15 },
});