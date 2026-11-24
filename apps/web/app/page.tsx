import { t } from "@microbeta/i18n";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">{t("app.name")}</h1>
      <p className="text-slate-500">{t("app.tagline")}</p>
    </main>
  );
}
