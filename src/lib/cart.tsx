"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "joysfood.cart.v1";

export type CartLine = {
  id: string;
  name: string;
  pricePaise: number;
  qty: number;
};

type CartContextValue = {
  lines: CartLine[];
  qtyOf: (id: string) => number;
  add: (item: { id: string; name: string; pricePaise: number }) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  totalQty: number;
  totalPaise: number;
  /** False until localStorage has been read. Guards against hydration drift. */
  ready: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function parseStored(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        typeof line === "object" &&
        line !== null &&
        typeof (line as CartLine).id === "string" &&
        typeof (line as CartLine).qty === "number" &&
        (line as CartLine).qty > 0,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // Server renders an empty cart; load the real one only after mount so the
  // first client render matches the server HTML.
  useEffect(() => {
    setLines(parseStored(window.localStorage.getItem(STORAGE_KEY)));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const setQty = useCallback((id: string, qty: number) => {
    setLines((current) =>
      qty <= 0
        ? current.filter((line) => line.id !== id)
        : current.map((line) => (line.id === id ? { ...line, qty } : line)),
    );
  }, []);

  const add = useCallback(
    (item: { id: string; name: string; pricePaise: number }) => {
      setLines((current) => {
        const existing = current.find((line) => line.id === item.id);
        if (existing) {
          return current.map((line) =>
            line.id === item.id ? { ...line, qty: line.qty + 1 } : line,
          );
        }
        return [...current, { ...item, qty: 1 }];
      });
    },
    [],
  );

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const byId = new Map(lines.map((line) => [line.id, line.qty]));
    return {
      lines,
      qtyOf: (id: string) => byId.get(id) ?? 0,
      add,
      setQty,
      clear,
      totalQty: lines.reduce((sum, line) => sum + line.qty, 0),
      totalPaise: lines.reduce(
        (sum, line) => sum + line.qty * line.pricePaise,
        0,
      ),
      ready,
    };
  }, [lines, add, setQty, clear, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
