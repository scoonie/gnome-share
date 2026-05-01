import { useCallback } from "react";
import { createIntl, createIntlCache, useIntl } from "react-intl";
import englishMessages from "../i18n/translations/en-US";

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
      locale: "en-US",
      messages: englishMessages,
      defaultLocale: "en-US",
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
