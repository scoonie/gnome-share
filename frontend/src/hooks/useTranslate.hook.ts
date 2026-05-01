import { useCallback } from "react";
import { createIntl, createIntlCache, useIntl } from "react-intl";
import i18nUtil from "../utils/i18n.util";
import { LOCALES } from "../i18n/locales";

const useTranslate = () => {
  const intl = useIntl();
  return useCallback(
    (
      id: string,
      values?: Parameters<typeof intl.formatMessage>[1],
      opts?: Parameters<typeof intl.formatMessage>[2],
    ) => intl.formatMessage({ id }, values, opts) as unknown as string,
    [intl],
  );
};

const cache = createIntlCache();

export const translateOutsideContext = () => {
  const intl = createIntl(
    {
      locale: LOCALES.ENGLISH.code,
      messages: i18nUtil.getLocaleByCode()?.messages,
      defaultLocale: LOCALES.ENGLISH.code,
    },
    cache,
  );
  return (
    id: string,
    values?: Parameters<typeof intl.formatMessage>[1],
    opts?: Parameters<typeof intl.formatMessage>[2],
  ) => {
    return intl.formatMessage({ id }, values, opts) as unknown as string;
  };
};

export default useTranslate;
