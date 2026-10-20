import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: '#2e7d32' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="por-clinica" options={{ title: 'Historial por clínica' }} />
      <Stack.Screen name="escaneos" options={{ title: 'Escaneos de la medalla' }} />
      <Stack.Screen name="privacidad" options={{ title: 'Privacidad de la ficha' }} />
      <Stack.Screen name="medalla" options={{ title: 'Medalla' }} />
    </Stack>
  );
}