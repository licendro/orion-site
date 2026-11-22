'use client';

import { useEffect } from 'react';

export default function ClearCart() {
  useEffect(() => {
    try {
      localStorage.removeItem('orion-cart-v1');
      localStorage.removeItem('orion-checkout-v1');
    } catch { /* stockage indisponible */ }
  }, []);
  return null;
}
