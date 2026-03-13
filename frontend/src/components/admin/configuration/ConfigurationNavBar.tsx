import {
  Box,
  Button,
  Group,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { Dispatch, SetStateAction } from "react";
import {
  TbAt,
  TbMail,
  TbScale,
  TbServerBolt,
  TbSettings,
  TbShare,
  TbSocial,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import classes from "./ConfigurationNavBar.module.css";

const categories = [
  { name: "General", icon: <TbSettings /> },
  { name: "Email", icon: <TbMail /> },
  { name: "Share", icon: <TbShare /> },
  { name: "SMTP", icon: <TbAt /> },
  { name: "OAuth", icon: <TbSocial /> },
  { name: "Legal", icon: <TbScale /> },
  { name: "Cache", icon: <TbServerBolt /> },
];

const ConfigurationNavBar = ({
  categoryId,
  isMobileNavBarOpened: _isMobileNavBarOpened,
  setIsMobileNavBarOpened,
}: {
  categoryId: string;
  isMobileNavBarOpened: boolean;
  setIsMobileNavBarOpened: Dispatch<SetStateAction<boolean>>;
}) => {
  const isSmallScreen = useMediaQuery("(max-width: 47.99em)");

  return (
    <Stack p="md" gap="xs" h="100%">
      <Text size="xs" c="dimmed" mb="sm">
        <FormattedMessage id="admin.config.title" />
      </Text>
      <Stack gap="xs">
        {categories.map((category) => (
          <Box
            p="xs"
            component={Link}
            onClick={() => setIsMobileNavBarOpened(false)}
            className={
              categoryId == category.name.toLowerCase()
                ? classes.activeLink
                : undefined
            }
            key={category.name}
            href={`/admin/config/${category.name.toLowerCase()}`}
          >
            <Group>
              <ThemeIcon
                variant={
                  categoryId == category.name.toLowerCase() ? "filled" : "light"
                }
              >
                {category.icon}
              </ThemeIcon>
              <Text size="sm">
                <FormattedMessage
                  id={`admin.config.category.${category.name.toLowerCase()}`}
                />
              </Text>
            </Group>
          </Box>
        ))}
      </Stack>
      {isSmallScreen && (
        <Button mt="xl" variant="light" component={Link} href="/admin">
          <FormattedMessage id="common.button.go-back" />
        </Button>
      )}
    </Stack>
  );
};

export default ConfigurationNavBar;
