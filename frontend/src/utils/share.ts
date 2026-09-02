import * as Clipboard from 'expo-clipboard';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

/** Downloads a remote file then hands it to the OS share sheet (native) or the browser (web). */
export async function downloadAndShare(url: string, filename: string): Promise<'shared' | 'downloaded'> {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    return 'downloaded';
  }
  const target = new Directory(Paths.cache, 'quortiv-exports');
  if (!target.exists) target.create({ intermediates: true });
  const destination = new File(target, filename);
  if (destination.exists) destination.delete();
  const result = await File.downloadFileAsync(url, destination);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri);
    return 'shared';
  }
  return 'downloaded';
}

/** Saves a text payload locally and shares it. */
export async function shareTextFile(content: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    return;
  }
  const target = new Directory(Paths.cache, 'quortiv-exports');
  if (!target.exists) target.create({ intermediates: true });
  const destination = new File(target, filename);
  if (destination.exists) destination.delete();
  destination.create();
  destination.write(content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(destination.uri);
}

/** Native share sheet for plain text / links. */
export async function shareText(message: string, title?: string) {
  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) {
      await nav.share({ text: message, title });
      return true;
    }
    await Clipboard.setStringAsync(message);
    return false;
  }
  await Share.share({ message, title });
  return true;
}

export async function copyToClipboard(text: string) {
  await Clipboard.setStringAsync(text);
}
