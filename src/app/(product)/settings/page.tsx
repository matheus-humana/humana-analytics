import { redirect } from "next/navigation";

/** Settings abre como painel na sidebar; a rota antiga redireciona. */
export default function SettingsPage() {
  redirect("/dashboard");
}
