import { LOCALES } from "../i18n/locales";

const getLocaleByCode = (code?: string) => {
  void code;
  return LOCALES.ENGLISH;
};

export default {
  getLocaleByCode,
};
