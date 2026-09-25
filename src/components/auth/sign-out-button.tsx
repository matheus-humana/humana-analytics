import { signOutAction } from "@/lib/auth/sign-out-action";

export function SignOutButton({ label = "Sair" }: { label?: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        title={label}
        data-no-collapse-toggle
        className="flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-[#f1f1f1] hover:text-foreground"
      >
        {label}
      </button>
    </form>
  );
}
