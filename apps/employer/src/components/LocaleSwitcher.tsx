import { setLocaleAction } from "@/features/locale/actions";
import type { Locale } from "@/lib/i18n/messages";

const options: ReadonlyArray<{ locale: Locale; label: string }> = [
  { locale: "ja", label: "日本語" },
  { locale: "en", label: "English" },
];

export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLocaleAction} aria-label={label} className="localeSwitcher">
      {options.map((option) => (
        <button
          aria-pressed={option.locale === locale}
          key={option.locale}
          name="locale"
          type="submit"
          value={option.locale}
        >
          {option.label}
        </button>
      ))}
    </form>
  );
}
