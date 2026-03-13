import { Button, Container, Group, Title } from "@mantine/core";
import Link from "next/link";
import { FormattedMessage } from "react-intl";
import Meta from "../components/Meta";
import classes from "./404.module.css";

const ErrorNotFound = () => {
  return (
    <>
      <Meta title="Not found" />
      <Container className={classes.root}>
        <div className={classes.label}>404</div>
        <Title ta="center" order={3}>
          <FormattedMessage id="404.description" />
        </Title>
        <Group justify="center" mt={50}>
          <Button component={Link} href="/" variant="light">
            <FormattedMessage id="404.button.home" />
          </Button>
        </Group>
      </Container>
    </>
  );
};
export default ErrorNotFound;
