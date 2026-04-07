import {
  Grid,
  Paper,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TbLink, TbRefresh, TbSettings, TbUsers } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import configService from "../../services/config.service";
import classes from "./admin.module.css";

const Admin = () => {
  const theme = useMantineTheme();
  const t = useTranslate();

  const [managementOptions, setManagementOptions] = useState([
    {
      title: t("admin.button.users"),
      icon: TbUsers,
      route: "/admin/users",
    },
    {
      title: t("admin.button.shares"),
      icon: TbLink,
      route: "/admin/shares",
    },
    {
      title: t("admin.button.config"),
      icon: TbSettings,
      route: "/admin/config/general",
    },
  ]);

  useEffect(() => {
    configService
      .isNewReleaseAvailable()
      .then((isNewReleaseAvailable) => {
        if (isNewReleaseAvailable) {
          setManagementOptions([
            ...managementOptions,
            {
              title: "Update",
              icon: TbRefresh,
              route:
                "https://github.com/scoonie/gnome-share/releases/latest",
            },
          ]);
        }
      })
      .catch();
  }, []);

  return (
    <>
      <Meta title={t("admin.title")} />
      <Title mb={30} order={3}>
        <FormattedMessage id="admin.title" />
      </Title>
      <Stack justify="space-between" style={{ height: "calc(100vh - 180px)" }}>
        <Paper withBorder p={40}>
          <Grid>
            {managementOptions.map((item) => {
              return (
                <Grid.Col span={6} key={item.route}>
                  <Paper
                    withBorder
                    component={Link}
                    href={item.route}
                    key={item.title}
                    className={classes.item}
                  >
                    <item.icon color={theme.colors.maroon[8]} size={35} />
                    <Text mt={7}>{item.title}</Text>
                  </Paper>
                </Grid.Col>
              );
            })}
          </Grid>
        </Paper>
      </Stack>
    </>
  );
};

export default Admin;
