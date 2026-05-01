import { LOCALES } from "../i18n/locales";

const getLocaleByCode = () => LOCALES.ENGLISH;

const getLanguageFromAcceptHeader = () => LOCALES.ENGLISH.code;

const isLanguageSupported = (code: string) => code === LOCALES.ENGLISH.code;

const setLanguageCookie = () => undefined;

export default {
  getLocaleByCode,
  getLanguageFromAcceptHeader,
  isLanguageSupported,
  setLanguageCookie,
};
