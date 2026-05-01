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
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import { GetServerSidePropsContext } from "next";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { IntlProvider } from "react-intl";
import Header from "../components/header/Header";
import { ConfigContext } from "../hooks/config.hook";
import { UserContext } from "../hooks/user.hook";
import englishMessages from "../i18n/translations/en-US";
import authService from "../services/auth.service";
import configService from "../services/config.service";
import userService from "../services/user.service";
import mantineTheme from "../styles/mantine.style";
import Config from "../types/config.type";
import { CurrentUser } from "../types/user.type";
import Footer from "../components/footer/Footer";

dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.extend(duration);

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
      12 * 60 * 1000, // access tokens last 15 minutes; refresh before expiry
    );

    return () => clearInterval(interval);
  }, []);

  const language = "en-US";
  dayjs.locale("en");

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </Head>
      <IntlProvider
        messages={englishMessages}
        locale={language}
        defaultLocale={language}
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
  } = {
    route: ctx.resolvedUrl,
  };

  if (ctx.req) {
    const apiURL = process.env.API_URL || "http://localhost:8080";
    const cookieHeader = ctx.req.headers.cookie;

    const [user, configVariables] = await Promise.all([
      axios(`${apiURL}/api/users/me`, {
        headers: { cookie: cookieHeader },
      })
        .then((res) => res.data)
        .catch(() => null),
      axios(`${apiURL}/api/configs`).then((res) => res.data),
    ]);
    pageProps.user = user;
    pageProps.configVariables = configVariables;

    pageProps.route = ctx.req.url;
  }
  return { pageProps };
};

export default App;
