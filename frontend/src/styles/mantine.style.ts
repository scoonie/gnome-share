import { MantineThemeOverride } from "@mantine/core";

export default <MantineThemeOverride>{
  colors: {
    maroon: [
      "#F4E2E4", // [0] Lightest (subtle backgrounds)
      "#E7C2C7", // [1]
      "#D89DA6", // [2]
      "#C67683", // [3]
      "#B24E5E", // [4]
      "#9E2A3B", // [5] Primary Button Color (Rich Maroon)
      "#8A2433", // [6] Hover State
      "#751F2A", // [7]
      "#5E1A23", // [8]
      "#4A151C", // [9] Darkest
    ],
  },
  primaryColor: "maroon", // Tell the app to use the maroon array
  components: {
    Modal: {
      styles: (theme) => ({
        title: {
          fontSize: theme.fontSizes.lg,
          fontWeight: 700,
        },
      }),
    },
  },
};
