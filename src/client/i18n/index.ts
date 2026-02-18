import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./ru.js";
import en from "./en.js";

const stored = localStorage.getItem("language");
const lng = stored === "en" ? "en" : "ru";

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng,
  fallbackLng: "ru",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
