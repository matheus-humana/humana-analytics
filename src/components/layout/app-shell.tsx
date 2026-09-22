import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({
  children,
  userName,
  signOut,
}: {
  children: React.ReactNode;
  userName: string;
  signOut: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:flex lg:items-start">
      <Sidebar userName={userName} signOut={signOut} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
