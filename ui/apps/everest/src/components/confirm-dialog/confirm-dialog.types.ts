import { ReactNode } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  selectedId: string;
  selectedNamespace?: string;
  closeModal: () => void;
  headerMessage: string;
  children: ReactNode;
  handleConfirm?: (selectedId: string) => void;
  handleConfirmNamespace?: (selectedId: string, namespace: string) => void;
  cancelMessage?: string;
  submitMessage?: string;
  disabledButtons?: boolean;
}
