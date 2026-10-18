import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerTintColor: '#2e7d32' }} />;
  <Stack.Screen name="privacidad" options={{ title: 'Privacidad de la ficha' }} />
}