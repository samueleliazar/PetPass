import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { obtenerToken } from '../api';

// Decide a dónde ir al abrir la app: con sesión → mascotas; sin sesión → login
export default function Inicio() {
  const [estado, setEstado] = useState<'revisando' | 'con-sesion' | 'sin-sesion'>('revisando');

  useEffect(() => {
    obtenerToken().then((token) => setEstado(token ? 'con-sesion' : 'sin-sesion'));
  }, []);

  if (estado === 'con-sesion') return <Redirect href="/mascotas" />;
  if (estado === 'sin-sesion') return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color="#2e7d32" />
    </View>
  );
}