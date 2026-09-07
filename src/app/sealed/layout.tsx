import type { ReactNode } from "react";
import LiveSealedDiscovery from "./live-sealed-discovery";

export default function SealedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LiveSealedDiscovery />
      {children}
    </>
  );
}
