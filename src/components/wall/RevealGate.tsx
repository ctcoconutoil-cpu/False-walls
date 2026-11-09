"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<{ opened: boolean; setOpened: (v: boolean) => void } | null>(null);

/** Holds whether a concealed wall has been opened, so the rest of the page can wait until it is. */
export function RevealGate({ initiallyOpen, children }: { initiallyOpen: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(initiallyOpen);
  return <Ctx.Provider value={{ opened, setOpened }}>{children}</Ctx.Provider>;
}
export const useRevealGate = () => useContext(Ctx);

/** Content that only shows once the wall is open. */
export function AfterOpen({ children }: { children: ReactNode }) {
  const g = useContext(Ctx);
  return g && !g.opened ? null : <>{children}</>;
}
