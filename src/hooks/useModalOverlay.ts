import { useEffect, useRef } from 'react';

// Global modal counter to support nested modals and prevent scroll locking race conditions
let openModalsCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';

/**
 * Custom hook for modal overlays:
 * 1. Locks background scroll (both body and documentElement overflow hidden) with ref-counting
 * 2. Closes modal on ESC key press
 * 3. Safely restores background scrolling when all modals are closed
 */
export function useModalOverlay(isOpen: boolean, onClose: () => void, disableEsc = false) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    if (openModalsCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    openModalsCount++;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEsc) {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      openModalsCount = Math.max(0, openModalsCount - 1);
      if (openModalsCount === 0) {
        // Safely reset overflow: if original overflow was 'hidden', reset to '' so the page never gets stuck
        document.body.style.overflow =
          originalBodyOverflow === 'hidden' ? '' : originalBodyOverflow;
        document.documentElement.style.overflow =
          originalHtmlOverflow === 'hidden' ? '' : originalHtmlOverflow;
      }
    };
  }, [isOpen, disableEsc]);
}

