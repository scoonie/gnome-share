import {
  Box,
  Center,
  MantineColorScheme,
  SegmentedControl,
  Stack,
  useMantineColorScheme,
} from "@mantine/core";
import { useState } from "react";
import { TbDeviceLaptop, TbMoon, TbSun } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import userPreferences from "../../utils/userPreferences.util";

const ThemeSwitcher = () => {
  const [colorScheme, setColorSchemeState] = useState(
    userPreferences.get("colorScheme"),
  );
  const { setColorScheme } = useMantineColorScheme();
  return (
    <Stack>
      <SegmentedControl
        value={colorScheme}
        onChange={(value) => {
          userPreferences.set("colorScheme", value);
          setColorSchemeState(value);
          setColorScheme(value === "system" ? "auto" : (value as MantineColorScheme));
        }}
        data={[
          {
            label: (
              <Center>
                <TbMoon size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.dark" />
                </Box>
              </Center>
            ),
            value: "dark",
          },
          {
            label: (
              <Center>
                <TbSun size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.light" />
                </Box>
              </Center>
            ),
            value: "light",
          },
          {
            label: (
              <Center>
                <TbDeviceLaptop size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.system" />
                </Box>
              </Center>
            ),
            value: "system",
          },
        ]}
      />
    </Stack>
  );
};

export default ThemeSwitcher;
