import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('cart') || '[]'));

  useEffect(() => localStorage.setItem('cart', JSON.stringify(cart)), [cart]);

  const addToCart = (event) =>
    setCart((c) => {
      const existing = c.find((l) => l.event.id === event.id);
      if (existing) return c.map((l) => (l.event.id === event.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { event, quantity: 1 }];
    });

  const setQuantity = (id, quantity) =>
    setCart((c) =>
      quantity < 1 ? c.filter((l) => l.event.id !== id) : c.map((l) => (l.event.id === id ? { ...l, quantity } : l))
    );

  const clearCart = () => setCart([]);
  const totalCents = cart.reduce((s, l) => s + l.event.priceCents * l.quantity, 0);
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, setQuantity, clearCart, totalCents, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
