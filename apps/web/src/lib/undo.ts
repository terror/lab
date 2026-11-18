import { toast } from 'sonner';

export function undoToast(message: string, onUndo: () => unknown) {
  toast(message, { action: { label: 'Undo', onClick: () => void onUndo() } });
}
