import type { ReactNode } from "react";
import LiveSealedDiscovery from "./live-sealed-discovery";
import HotRightNow from "./hot-right-now";

export default function SealedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LiveSealedDiscovery />
      <HotRightNow />
      {children}
    </>
  );
}
