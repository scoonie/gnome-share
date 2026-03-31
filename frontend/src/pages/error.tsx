import React from "react";
import { Button, Stack, Text, Title } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import Meta from "../components/Meta";
import useTranslate from "../hooks/useTranslate.hook";
import { useRouter } from "next/router";
import { FormattedMessage } from "react-intl";
import { safeRedirectPath } from "../utils/router.util";
import classes from "./error.module.css";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: {
      redirectPath: safeRedirectPath(context.query.redirect as string | undefined, "/"),
      errorCode: (context.query.error as string) || "default",
      params: context.query.params
        ? (context.query.params as string).split(",")
        : [],
    },
  };
}

export default function Error({
  redirectPath,
  errorCode,
  params: rawParams,
}: {
  redirectPath: string;
  errorCode: string;
  params: string[];
}) {
  const t = useTranslate();
  const router = useRouter();

  const params = rawParams.map((param) => t(`error.param.${param}`));

  return (
    <>
      <Meta title={t("error.title")} />
      <Stack align="center">
        <Title order={3} className={classes.title}>
          {t("error.description")}
        </Title>
        <Text mt="xl" size="lg">
          <FormattedMessage
            id={`error.msg.${errorCode}`}
            values={Object.fromEntries(
              [params].map((value, key) => [key.toString(), value]),
            )}
          />
        </Text>
        <Button
          mt="xl"
          onClick={() => router.push(redirectPath)}
        >
          {t("error.button.back")}
        </Button>
      </Stack>
    </>
  );
}
