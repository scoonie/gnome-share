import { LOCALES } from "../i18n/locales";

const getLocaleByCode = (localeCode?: string) =>
  Object.values(LOCALES).find((locale) => locale.code === localeCode) ??
  LOCALES.ENGLISH;

export default {
  getLocaleByCode,
};
