import {
  Button,
  Container,
  Group,
  List,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TbCheck } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Logo from "../components/Logo";
import Meta from "../components/Meta";
import useUser from "../hooks/user.hook";
import useConfig from "../hooks/config.hook";
import classes from "./index.module.css";

export default function Home() {
  const { refreshUser } = useUser();
  const router = useRouter();
  const config = useConfig();
  const [signupEnabled, setSignupEnabled] = useState(true);

  // If user is already authenticated, redirect to the upload page
  useEffect(() => {
    refreshUser().then((user) => {
      if (user) {
        router.replace("/upload");
      }
    });

    // If registration is disabled, get started button should redirect to the sign in page
    try {
      const allowRegistration = config.get("share.allowRegistration");
      setSignupEnabled(allowRegistration !== false);
    } catch (error) {
      setSignupEnabled(true);
    }
  }, [config]);

  const getButtonHref = () => {
    return signupEnabled ? "/auth/signUp" : "/auth/signIn";
  };

  return (
    <>
      <Meta title="Home" />
      <Container>
        <div className={classes.inner}>
          <div className={classes.content}>
            <Title className={classes.title}>
              <FormattedMessage
                id="home.title"
                values={{
                  h: (chunks) => (
                    <span className={classes.highlight}>{chunks}</span>
                  ),
                }}
              />
            </Title>
            <Text c="dimmed" mt="md">
              <FormattedMessage id="home.description" />
            </Text>

            <List
              mt={30}
              gap="sm"
              size="sm"
              icon={
                <ThemeIcon size={20} radius="xl">
                  <TbCheck size={12} />
                </ThemeIcon>
              }
            >
              <List.Item>
                <div>
                  <b>
                    <FormattedMessage id="home.bullet.a.name" />
                  </b>{" "}
                  - <FormattedMessage id="home.bullet.a.description" />
                </div>
              </List.Item>
              <List.Item>
                <div>
                  <b>
                    <FormattedMessage id="home.bullet.b.name" />
                  </b>{" "}
                  - <FormattedMessage id="home.bullet.b.description" />
                </div>
              </List.Item>
              <List.Item>
                <div>
                  <b>
                    <FormattedMessage id="home.bullet.c.name" />
                  </b>{" "}
                  - <FormattedMessage id="home.bullet.c.description" />
                </div>
              </List.Item>
            </List>

            <Group mt={30}>
              <Button
                component={Link}
                href={getButtonHref()}
                radius="xl"
                size="md"
                className={classes.control}
              >
                <FormattedMessage id="home.button.start" />
              </Button>
              <Button
                component={Link}
                href="https://github.com/stonith404/pingvin-share"
                target="_blank"
                variant="default"
                radius="xl"
                size="md"
                className={classes.control}
              >
                <FormattedMessage id="home.button.source" />
              </Button>
            </Group>
          </div>
          <Group className={classes.image} align="center">
            <Logo width={200} height={200} />
          </Group>
        </div>
      </Container>
    </>
  );
}
