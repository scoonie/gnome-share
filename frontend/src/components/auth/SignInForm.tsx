import {
  Anchor,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TbInfoCircle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import * as yup from "yup";
import useConfig from "../../hooks/config.hook";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import authService from "../../services/auth.service";
import { getOAuthIcon, getOAuthUrl } from "../../utils/oauth.util";
import { safeRedirectPath } from "../../utils/router.util";
import toast from "../../utils/toast.util";
import classes from "./SignInForm.module.css";

const SignInForm = ({ redirectPath }: { redirectPath: string }) => {
  const config = useConfig();
  const router = useRouter();
  const t = useTranslate();
  const { refreshUser } = useUser();

  const [oauthProviders, setOauthProviders] = useState<string[] | null>(null);
  const [isRedirectingToOauthProvider, setIsRedirectingToOauthProvider] =
    useState(false);

  // Safely check if the secret "?admin=true" flag is in the URL (incorporating Copilot's advice)
  const isAdminLogin = router.query?.admin === "true" || router.query?.admin?.includes("true");

  const validationSchema = yup.object().shape({
    emailOrUsername: yup.string().required(t("common.error.field-required")),
    password: yup.string().required(t("common.error.field-required")),
  });

  const form = useForm({
    initialValues: {
      emailOrUsername: "",
      password: "",
    },
    validate: yupResolver(validationSchema),
  });

  const signIn = async (email: string, password: string) => {
    await authService
      .signIn(email.trim(), password.trim())
      .then(async (response) => {
        if (response.data["loginToken"]) {
          showNotification({
            icon: <TbInfoCircle />,
            color: "blue",
            radius: "md",
            title: t("signIn.notify.totp-required.title"),
            message: t("signIn.notify.totp-required.description"),
          });
          router.push(
            `/auth/totp/${
              response.data["loginToken"]
            }?redirect=${encodeURIComponent(redirectPath)}`,
          );
        } else {
          await refreshUser();
          router.replace(safeRedirectPath(redirectPath));
        }
      })
      .catch(toast.axiosError);
  };

  useEffect(() => {
    authService
      .getAvailableOAuth()
      .then((providers) => {
        setOauthProviders(providers.data);
        
        // Auto-redirect normal users to Google if it's the only provider.
        // If the admin flag is present, stop the redirect so the form can load!
        if (
          providers.data.length === 1 &&
          (config.get("oauth.disablePassword") || !isAdminLogin)
        ) {
          setIsRedirectingToOauthProvider(true);
          router.push(getOAuthUrl(window.location.origin, providers.data[0]));
        }
      })
      .catch(toast.axiosError);
  // Add dependencies requested by the linter/Copilot
  }, [isAdminLogin, config, router]); 

  if (!oauthProviders) return null;

  if (isRedirectingToOauthProvider)
    return (
      <Group align="center" justify="center">
        <Loader size="sm" />
        <Text ta="center">
          <FormattedMessage id="common.text.redirecting" />
        </Text>
      </Group>
    );

  // Determine whether to render the local password form (incorporating Copilot's optional chaining)
  const showPasswordForm = 
    !config.get("oauth.disablePassword") && 
    (isAdminLogin || oauthProviders?.length === 0);

  return (
    <Container size={420} my={40}>
      <Title order={2} ta="center" fw={900}>
        <FormattedMessage id="signin.title" />
      </Title>
      
      {/* Hide the registration text if the password form is hidden */}
      {config.get("share.allowRegistration") && showPasswordForm && (
        <Text c="dimmed" size="sm" ta="center" mt={5}>
          <FormattedMessage id="signin.description" />{" "}
          <Anchor component={Link} href={"signUp"} size="sm">
            <FormattedMessage id="signin.button.signup" />
          </Anchor>
        </Text>
      )}
      
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        
        {/* Render the local form only if showPasswordForm evaluates to true */}
        {showPasswordForm && (
          <form
            onSubmit={form.onSubmit((values) => {
              signIn(values.emailOrUsername, values.password);
            })}
          >
            <TextInput
              label={t("signin.input.email-or-username")}
              placeholder={t("signin.input.email-or-username.placeholder")}
              {...form.getInputProps("emailOrUsername")}
            />
            <PasswordInput
              label={t("signin.input.password")}
              placeholder={t("signin.input.password.placeholder")}
              mt="md"
              {...form.getInputProps("password")}
            />
            {config.get("smtp.enabled") && (
              <Group justify="flex-end" mt="xs">
                <Anchor component={Link} href="/auth/resetPassword" size="xs">
                  <FormattedMessage id="resetPassword.title" />
                </Anchor>
              </Group>
            )}
            <Button fullWidth mt="xl" type="submit">
              <FormattedMessage id="signin.button.submit" />
            </Button>
          </form>
        )}

        {/* OAuth Buttons logic */}
        {oauthProviders.length > 0 && (
          <Stack mt={!showPasswordForm ? undefined : "xl"}>
            {!showPasswordForm ? (
              <Group align="center" className={classes.signInWith}>
                <Text>{t("signIn.oauth.signInWith")}</Text>
              </Group>
            ) : (
              <Group align="center" className={classes.or}>
                <Text>{t("signIn.oauth.or")}</Text>
              </Group>
            )}
            <Group justify="center">
              {oauthProviders.map((provider) => (
                <Button
                  key={provider}
                  component="a"
                  title={t(`signIn.oauth.${provider}`)}
                  href={getOAuthUrl(window.location.origin, provider)}
                  variant="light"
                  fullWidth
                >
                  {getOAuthIcon(provider)}
                  {"\u2002" + t(`signIn.oauth.${provider}`)}
                </Button>
              ))}
            </Group>
          </Stack>
        )}
      </Paper>
    </Container>
  );
};

export default SignInForm;
