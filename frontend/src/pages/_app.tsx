import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "../styles/global.css";
import {
  MantineProvider,
  Container,
  Stack,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import axios from "axios";
import { getCookie } from "cookies-next";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import "dayjs/locale/ar";
import "dayjs/locale/cs";
import "dayjs/locale/da";
import "dayjs/locale/de";
import "dayjs/locale/el";
import "dayjs/locale/es";
import "dayjs/locale/et";
import "dayjs/locale/fi";
import "dayjs/locale/fr";
import "dayjs/locale/hr";
import "dayjs/locale/hu";
import "dayjs/locale/it";
import "dayjs/locale/ja";
import "dayjs/locale/ko";
import "dayjs/locale/nl-be";
import "dayjs/locale/pl";
import "dayjs/locale/pt-br";
import "dayjs/locale/ru";
import "dayjs/locale/sl";
import "dayjs/locale/sr";
import "dayjs/locale/sv";
import "dayjs/locale/th";
import "dayjs/locale/tr";
import "dayjs/locale/uk";
import "dayjs/locale/vi";
import "dayjs/locale/zh-cn";
import "dayjs/locale/zh-tw";
import { GetServerSidePropsContext } from "next";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { IntlProvider } from "react-intl";
import Header from "../components/header/Header";
import { ConfigContext } from "../hooks/config.hook";
import { UserContext } from "../hooks/user.hook";
import { LOCALES } from "../i18n/locales";
import authService from "../services/auth.service";
import configService from "../services/config.service";
import userService from "../services/user.service";
import mantineTheme from "../styles/mantine.style";
import Config from "../types/config.type";
import { CurrentUser } from "../types/user.type";
import i18nUtil from "../utils/i18n.util";
import Footer from "../components/footer/Footer";

dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.extend(duration);

const DAYJS_LOCALE_MAP: Record<string, string> = {
  "ar-EG": "ar",
  "cs-CZ": "cs",
  "da-DK": "da",
  "de-DE": "de",
  "el-GR": "el",
  "en-US": "en",
  "es-ES": "es",
  "et-EE": "et",
  "fi-FI": "fi",
  "fr-FR": "fr",
  "hr-HR": "hr",
  "hu-HU": "hu",
  "it-IT": "it",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "nl-BE": "nl-be",
  "pl-PL": "pl",
  "pt-BR": "pt-br",
  "ru-RU": "ru",
  "sl-SI": "sl",
  "sr-CS": "sr",
  "sr-SP": "sr",
  "sv-SE": "sv",
  "th-TH": "th",
  "tr-TR": "tr",
  "uk-UA": "uk",
  "vi-VN": "vi",
  "zh-CN": "zh-cn",
  "zh-TW": "zh-tw",
};

const excludeDefaultLayoutRoutes = ["/admin/config/[category]"];

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(pageProps.user);
  const [route, setRoute] = useState<string>(pageProps.route);

  const [configVariables, setConfigVariables] = useState<Config[]>(
    pageProps.configVariables,
  );

  useEffect(() => {
    setRoute(router.pathname);
  }, [router.pathname]);

  useEffect(() => {
    const interval = setInterval(
      async () => await authService.refreshAccessToken(),
      2 * 60 * 1000, // 2 minutes
    );

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!pageProps.language) return;
    const cookieLanguage = getCookie("language");
    if (pageProps.language != cookieLanguage) {
      i18nUtil.setLanguageCookie(pageProps.language);
      if (cookieLanguage) location.reload();
    }
  }, []);

  const language = useRef(pageProps.language);
  dayjs.locale(DAYJS_LOCALE_MAP[language.current] ?? language.current);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </Head>
      <IntlProvider
        messages={i18nUtil.getLocaleByCode(language.current)?.messages}
        locale={language.current}
        defaultLocale={LOCALES.ENGLISH.code}
      >
        <MantineProvider
          theme={mantineTheme}
          defaultColorScheme="dark"
        >
          <Notifications />
          <ModalsProvider>
            <ConfigContext.Provider
              value={{
                configVariables,
                refresh: async () => {
                  setConfigVariables(await configService.list());
                },
              }}
            >
              <UserContext.Provider
                value={{
                  user,
                  refreshUser: async () => {
                    const user = await userService.getCurrentUser();
                    setUser(user);
                    return user;
                  },
                }}
              >
                {excludeDefaultLayoutRoutes.includes(route) ? (
                  <Component {...pageProps} />
                ) : (
                  <>
                    <Stack
                      justify="space-between"
                      style={{ minHeight: "100vh" }}
                    >
                      <div>
                        <Header />
                        <Container>
                          <Component {...pageProps} />
                        </Container>
                      </div>
                      <Footer />
                    </Stack>
                  </>
                )}
              </UserContext.Provider>
            </ConfigContext.Provider>
          </ModalsProvider>
        </MantineProvider>
      </IntlProvider>
    </>
  );
}

// Fetch user and config variables on server side when the first request is made
// These will get passed as a page prop to the App component and stored in the contexts
App.getInitialProps = async ({ ctx }: { ctx: GetServerSidePropsContext }) => {
  let pageProps: {
    user?: CurrentUser;
    configVariables?: Config[];
    route?: string;
    language?: string;
  } = {
    route: ctx.resolvedUrl,
  };

  if (ctx.req) {
    const apiURL = process.env.API_URL || "http://localhost:8080";
    const cookieHeader = ctx.req.headers.cookie;

    pageProps.user = await axios(`${apiURL}/api/users/me`, {
      headers: { cookie: cookieHeader },
    })
      .then((res) => res.data)
      .catch(() => null);

    pageProps.configVariables = (await axios(`${apiURL}/api/configs`)).data;

    pageProps.route = ctx.req.url;

    const requestLanguage = i18nUtil.getLanguageFromAcceptHeader(
      ctx.req.headers["accept-language"],
    );

    pageProps.language = ctx.req.cookies["language"] ?? requestLanguage;
  }
  return { pageProps };
};

export default App;
