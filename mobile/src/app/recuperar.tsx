import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../api';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (!email.trim()) return Alert.alert('Falta el correo', 'Escribe el correo de tu cuenta.');
    setEnviando(true);
    try {
      await api('/auth/recuperar', { metodo: 'POST', cuerpo: { email: email.trim() } });
      setEnviado(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <View style={estilos.fondo}>
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>📧 Revisa tu correo</Text>
          <Text style={estilos.texto}>
            Si {email.trim()} está registrado, te enviamos un enlace para crear una nueva contraseña.
            Vence en 30 minutos.
          </Text>
          <Text style={estilos.texto}>Después de cambiarla, vuelve aquí e inicia sesión.</Text>
          <Pressable style={estilos.boton} onPress={() => router.back()}>
            <Text style={estilos.textoBoton}>Volver al inicio de sesión</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={estilos.fondo}>
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>¿Olvidaste tu contraseña?</Text>
        <Text style={estilos.texto}>
          Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.
        </Text>
        <TextInput
          style={estilos.input}
          value={email}
          onChangeText={setEmail}
          placeholder="tucorreo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[estilos.boton, enviando && { opacity: 0.6 }]}
          onPress={enviar}
          disabled={enviando}
        >
          <Text style={estilos.textoBoton}>{enviando ? 'Enviando…' : 'Enviar enlace'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  titulo: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 8 },
  texto: { fontSize: 15, color: '#555', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 16, marginVertical: 8 },
  boton: { backgroundColor: '#2e7d32', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  textoBoton: { color: '#fff', fontWeight: '600', fontSize: 16 },
});