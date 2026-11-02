import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

// Se carga "a pedido" (como nfc.ts): en Expo Go o en un APK antiguo sin la librería,
// la app no se cae; simplemente no registra el push.
function cargarNotificaciones(): typeof import('expo-notifications') | null {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

const Notifications = cargarNotificaciones();

// Mostrar la notificación aunque la app esté abierta
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Pide permiso, obtiene el token de push del teléfono y lo guarda en el backend.
// Solo Android (en iPhone se necesita una cuenta de Apple Developer pagada).
export async function registrarPush() {
  if (!Notifications || Platform.OS !== 'android') return;

  try {
    // Canal de Android: define cómo suena y se muestra el aviso
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos de PetPass',
      importance: Notifications.AndroidImportance.HIGH,
    });

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return; // el usuario no dio permiso: la app sigue igual

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await api('/push/token', { metodo: 'PUT', cuerpo: { token } });
  } catch (e) {
    // Si falla (por ejemplo, en Expo Go), no molestamos al usuario
    console.log('No se pudo registrar el push:', e);
  }
}