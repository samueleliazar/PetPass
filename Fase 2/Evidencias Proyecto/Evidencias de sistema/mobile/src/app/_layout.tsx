import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
     <Stack
      screenOptions={{
        headerTintColor: '#2e7d32',
        headerTransparent: false,
        headerStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="documentos" options={{ title: 'Carnets y documentos' }} />
      <Stack.Screen name="escanear" options={{ title: 'Escanear' }} />
      <Stack.Screen name="documento" options={{ title: 'Documento' }} />
      <Stack.Screen name="por-clinica" options={{ title: 'Historial por clínica' }} />
      <Stack.Screen name="escaneos" options={{ title: 'Escaneos de la medalla' }} />
      <Stack.Screen name="privacidad" options={{ title: 'Privacidad de la ficha' }} />
      <Stack.Screen name="medalla" options={{ title: 'Medalla' }} />
      <Stack.Screen name="recuperar" options={{ title: 'Recuperar contraseña' }} />
      <Stack.Screen name="convertir" options={{ title: 'Agregar al historial' }} />
    </Stack>
  );
}