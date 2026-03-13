import { Burger, Button, Group, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { Dispatch, SetStateAction } from "react";
import { FormattedMessage } from "react-intl";
import useConfig from "../../../hooks/config.hook";
import Logo from "../../Logo";

const ConfigurationHeader = ({
  isMobileNavBarOpened,
  setIsMobileNavBarOpened,
}: {
  isMobileNavBarOpened: boolean;
  setIsMobileNavBarOpened: Dispatch<SetStateAction<boolean>>;
}) => {
  const config = useConfig();
  const isSmallScreen = useMediaQuery("(max-width: 47.99em)");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        padding: "0 var(--mantine-spacing-md)",
      }}
    >
      {isSmallScreen && (
        <Burger
          opened={isMobileNavBarOpened}
          onClick={() => setIsMobileNavBarOpened((o) => !o)}
          size="sm"
          mr="xl"
        />
      )}
      <Group justify="space-between" w="100%">
        <Link href="/" passHref>
          <Group>
            <Logo height={35} width={35} />
            <Text fw={600}>{config.get("general.appName")}</Text>
          </Group>
        </Link>
        {!isSmallScreen && (
          <Button variant="light" component={Link} href="/admin">
            <FormattedMessage id="common.button.go-back" />
          </Button>
        )}
      </Group>
    </div>
  );
};

export default ConfigurationHeader;
