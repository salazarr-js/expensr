import { AlertDialog } from "@/components/AlertDialog";
import type { AlertDialogColor } from "@/components/AlertDialog";

interface AlertDialogOptions {
  title?: string;
  message?: string;
  /** Optional list of items displayed as chips below the message. */
  chips?: string[];
  icon?: string;
  color?: AlertDialogColor;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => Promise<void> | void;
}

/** Composable for showing confirmation dialogs via `useOverlay`. */
export function useAlertDialog() {
  const overlay = useOverlay();

  async function open(options: AlertDialogOptions = {}): Promise<boolean> {
    const instance = overlay.create(AlertDialog, { props: options });
    return await instance.open();
  }

  /** Red confirmation dialog for irreversible actions (e.g. delete). */
  async function destructive(options: AlertDialogOptions = {}): Promise<boolean> {
    return open({
      title: "Are you sure?",
      message: "This action cannot be undone.",
      icon: "i-lucide-trash-2",
      color: "error",
      confirmLabel: "Delete",
      ...options,
    });
  }

  /** Amber confirmation dialog for cautionary actions. */
  async function warning(options: AlertDialogOptions = {}): Promise<boolean> {
    return open({
      title: "Are you sure?",
      message: "This action may have consequences.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
      confirmLabel: "Continue",
      ...options,
    });
  }

  /** Neutral confirmation dialog for general-purpose prompts. */
  async function confirm(options: AlertDialogOptions = {}): Promise<boolean> {
    return open({
      title: "Confirm",
      message: "Do you want to proceed?",
      icon: "i-lucide-help-circle",
      color: "primary",
      confirmLabel: "Confirm",
      ...options,
    });
  }

  return { destructive, warning, confirm };
}
