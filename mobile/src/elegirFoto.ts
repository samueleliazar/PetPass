import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Abre la cámara o la galería y devuelve la foto como JPG achicado (o null si se canceló)
export async function elegirFoto(
  origen: 'camara' | 'galeria',
  opciones: { anchoMaximo?: number; cuadrada?: boolean } = {}
): Promise<string | null> {
  const { anchoMaximo = 1600, cuadrada = false } = opciones;
  const config: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: cuadrada, // permite recortar
    aspect: cuadrada ? [1, 1] : undefined,
  };

  let resultado: ImagePicker.ImagePickerResult;
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso de cámara', 'Permite el acceso a la cámara en los Ajustes del teléfono.');
      return null;
    }
    resultado = await ImagePicker.launchCameraAsync(config);
  } else {
    resultado = await ImagePicker.launchImageLibraryAsync(config);
  }
  if (resultado.canceled) return null;

  const asset = resultado.assets[0];
  const acciones = asset.width > anchoMaximo ? [{ resize: { width: anchoMaximo } }] : [];
  const foto = await manipulateAsync(asset.uri, acciones, { compress: 0.8, format: SaveFormat.JPEG });
  return foto.uri;
}