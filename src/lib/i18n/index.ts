import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR";

// pt-BR is the only active locale today; the structure supports adding more without
// refactoring. Namespaces mirror the resource object top-level keys.
export const resources = { "pt-BR": ptBR } as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: Localization.getLocales()[0]?.languageTag ?? "pt-BR",
    fallbackLng: "pt-BR",
    supportedLngs: ["pt-BR"],
    ns: Object.keys(ptBR),
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
