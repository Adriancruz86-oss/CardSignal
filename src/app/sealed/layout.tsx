import type { ReactNode } from "react";
import LiveSealedDiscovery from "./live-sealed-discovery";
import HotRightNow from "./hot-right-now";
import SealedVisualShelf from "./sealed-visual-shelf";

export default function SealedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LiveSealedDiscovery />
      <HotRightNow />
      <SealedVisualShelf />
      {children}
    </>
  );
}
