"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  const { t } = useI18n();

  return (
    <main className="content-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("OUTSIDE THE MAP")}</div>
          <h1>
            {t("This page is")}
            <br />
            {t("off our grid.")}
          </h1>
          <p>{t("Return to the active London model to continue exploring.")}</p>
        </div>
      </div>
      <Button asChild>
        <Link href="/explore">{t("Explore London")}</Link>
      </Button>
    </main>
  );
}
