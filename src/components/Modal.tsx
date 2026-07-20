import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Portals to document.body so the overlay is always positioned against the real viewport.
 * Rendering a `position: fixed` overlay inline (e.g. inside the header) breaks on any ancestor
 * with backdrop-filter/filter/transform, since that becomes the containing block instead of
 * the viewport — the overlay ends up clipped to that ancestor's box instead of covering the page.
 */
export default function Modal({ onClose, className = "", children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // lock background scroll while open (esp. on mobile)
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal panel ${className}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        {children}
      </div>
    </div>,
    document.body
  );
}
