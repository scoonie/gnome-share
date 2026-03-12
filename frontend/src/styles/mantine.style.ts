import { MantineThemeOverride } from "@mantine/core";

const maroonShades = [
  "#F4E2E4", // [0]
  "#E7C2C7", // [1]
  "#D89DA6", // [2]
  "#C67683", // [3]
  "#B24E5E", // [4]
  "#9E2A3B", // [5]
  "#8A2433", // [6]
  "#751F2A", // [7]
  "#5E1A23", // [8]
  "#4A151C", // [9]
];

export default <MantineThemeOverride>{
  colors: {
    maroon: maroonShades,
    victoria: maroonShades,
  },
  primaryColor: "maroon",
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
