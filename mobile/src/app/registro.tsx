import { useState } from 'react';
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { api, guardarToken } from '../api';

type RespuestaLogin = { token: string };

export default function Registro() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Validaciones rápidas en el teléfono (el backend vuelve a validar todo)
  function validar(): string {
    if (!nombre.trim() || !email.trim() || !telefono.trim() || !password) {
      return 'Completa todos los campos';
    }
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (password !== confirmacion) return 'Las contraseñas no coinciden';
    return '';
  }

  async function crearCuenta() {
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }

    setError('');
    setCargando(true);
    try {
      const datos = {
        nombre_completo: nombre.trim(),
        email: email.trim(),
        telefono: telefono.replace(/\s/g, ''), // "+569 1234 5678" → "+56912345678"
        password,
      };

      // 1) Crear la cuenta (HU01)
      await api('/auth/registro', { metodo: 'POST', cuerpo: datos });

      // 2) Iniciar sesión automáticamente con los mismos datos
      const sesion = await api<RespuestaLogin>('/auth/login', {
        metodo: 'POST',
        cuerpo: { email: datos.email, password },
      });
      await guardarToken(sesion.token);

      // 3) Ir a la lista, sacando el login y el registro del historial
      if (router.canDismiss()) router.dismissAll();
      router.replace('/mascotas');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado');
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Crear cuenta' }} />

      <ScrollView contentContainerStyle={estilos.contenedor} keyboardShouldPersistTaps="handled">
        <Text style={estilos.subtitulo}>
          Tus datos de contacto se usarán para que puedan ubicarte si tu mascota se pierde.
        </Text>

        <TextInput
          style={estilos.input}
          placeholder="Nombre y apellido"
          value={nombre}
          onChangeText={setNombre}
          autoComplete="name"
        />
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
          placeholder="Teléfono (ej: +56912345678)"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <TextInput
          style={estilos.input}
          placeholder="Contraseña (mínimo 8 caracteres)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={estilos.input}
          placeholder="Repite la contraseña"
          value={confirmacion}
          onChangeText={setConfirmacion}
          secureTextEntry
        />

        {error ? <Text style={estilos.error}>{error}</Text> : null}

        <Pressable
          style={[estilos.boton, cargando && estilos.botonDesactivado]}
          onPress={crearCuenta}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.textoBoton}>Crear cuenta</Text>
          )}
        </Pressable>
            
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { padding: 24 },
  subtitulo: { fontSize: 15, color: '#666', marginBottom: 24 },
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
    
});