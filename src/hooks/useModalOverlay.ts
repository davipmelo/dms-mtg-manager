import { useEffect } from 'react';

/**
 * Custom hook for modal overlays:
 * 1. Locks background scroll (both body and documentElement overflow hidden)
 * 2. Closes modal on ESC key press
 */
export function useModalOverlay(isOpen: boolean, onClose: () => void, disableEsc = false) {
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEsc) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, disableEsc]);
}
