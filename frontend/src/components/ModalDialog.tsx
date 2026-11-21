import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalDialogProps {
    titleId: string;
    busy: boolean;
    onClose: () => void;
    className?: string;
    children: ReactNode;
}

// showModal makes the background inert and contains keyboard focus natively.
export default function ModalDialog({ titleId, busy, onClose, className = '', children }: ModalDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    useLayoutEffect(() => {
        const dialog = dialogRef.current!;
        const trigger = document.activeElement;
        dialog.showModal();
        dialog.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus();
        return () => {
            dialog.close();
            if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
        };
    }, []);

    useLayoutEffect(() => {
        if (busy) dialogRef.current?.focus({ preventScroll: true });
    }, [busy]);

    return createPortal(
        <dialog
            ref={dialogRef}
            tabIndex={-1}
            onKeyDown={(event) => {
                if (event.key !== 'Tab') return;
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
                )).filter(element => element.getClientRects().length > 0);
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (!first) {
                    event.preventDefault();
                    event.currentTarget.focus();
                } else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
                    event.preventDefault();
                    first.focus();
                }
            }}
            className={`import-modal ${className}`}
            aria-labelledby={titleId}
            aria-modal="true"
            aria-busy={busy}
            onCancel={(event) => {
                // A file input also bubbles a cancel event when its picker is dismissed.
                if (event.target !== event.currentTarget) return;
                event.preventDefault();
                if (!busy) onClose();
            }}
            onClick={(event) => {
                if (event.target !== event.currentTarget || busy) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right
                    || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
            }}
        >
            {children}
        </dialog>,
        document.body,
    );
}
