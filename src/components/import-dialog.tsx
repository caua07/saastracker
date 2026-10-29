"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./ui";
import "./imports/imports.css";

export function ImportDialog({
  open,
  onClose,
  busy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="import-dialog-overlay" />
        <Dialog.Content
          className="import-dialog"
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            if (returnFocus.current?.isConnected) {
              e.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <header className="import-dialog-header">
            <div>
              <Dialog.Title>Importar extrato</Dialog.Title>
              <Dialog.Description>
                Do arquivo para o seu espaço. Com tudo conferido.
              </Dialog.Description>
            </div>
            <IconButton label="Fechar painel" disabled={busy} onClick={onClose}>
              <X size={20} />
            </IconButton>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
