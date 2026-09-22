import Image from "next/image";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const missingEnv = [
    process.env.GOOGLE_CLIENT_ID?.trim() ? null : "GOOGLE_CLIENT_ID",
    process.env.GOOGLE_CLIENT_SECRET?.trim() ? null : "GOOGLE_CLIENT_SECRET",
    (
      process.env.AUTH_SECRET?.trim() ||
      process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()
    )
      ? null
      : "AUTH_SECRET",
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm shadow-black/5 sm:p-8">
        <Image
          src="/brand/logo-preto-humana.png"
          alt="Humana Artificial Intelligence"
          width={160}
          height={42}
          className="h-9 w-auto"
          priority
        />
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-foreground">
          Humana Analytics
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Entre com Google para consultar tráfego, conversões e UX do site
          Humana. O chat só responde com dados das fontes conectadas.
        </p>

        {params.error ? (
          <p className="mt-4 rounded-lg border border-border bg-[#f1f1f1] px-3 py-2 text-sm text-foreground">
            Não foi possível entrar com Google. Tente novamente.
          </p>
        ) : null}

        {missingEnv.length > 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-[#f1f1f1] px-3 py-2 text-sm text-foreground">
            Login ainda não está configurado neste ambiente. Defina no
            servidor: {missingEnv.join(", ")}.
          </p>
        ) : (
          <form
            className="mt-6"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0]"
            >
              Entrar com Google
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
