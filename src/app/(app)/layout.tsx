import { ProveedorAvisos } from "@/components/ui";
import { Shell } from "@/components/Shell";
import { SessionProvider } from "@/lib/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorAvisos>
      <SessionProvider>
        <Shell>{children}</Shell>
      </SessionProvider>
    </ProveedorAvisos>
  );
}
