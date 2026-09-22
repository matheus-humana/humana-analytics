import { signOut } from "@/lib/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        title="Sair"
        data-no-collapse-toggle
        className="flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-[#f1f1f1] hover:text-foreground"
      >
        Sair
      </button>
    </form>
  );
}
