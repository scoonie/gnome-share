import { LoadingOverlay } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SignInForm from "../../components/auth/SignInForm";
import Meta from "../../components/Meta";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { redirectPath: context.query.redirect ?? null },
  };
}

const sanitizeRedirectPath = (redirectPath?: string | string[] | null): string => {
  if (Array.isArray(redirectPath)) {
    redirectPath = redirectPath[0];
  }

  if (typeof redirectPath !== "string" || redirectPath.trim() === "") {
    return "/upload";
  }

  const trimmed = redirectPath.trim();

  // Disallow absolute URLs and protocol-like patterns to prevent open redirects
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return "/upload";
  }

  // Only allow internal paths
  if (!trimmed.startsWith("/")) {
    return "/upload";
  }

  return trimmed;
};

const SignIn = ({ redirectPath }: { redirectPath?: string }) => {
  const { refreshUser } = useUser();
  const router = useRouter();
  const t = useTranslate();

  const safeRedirectPath = sanitizeRedirectPath(redirectPath ?? null);
  const [isLoading, setIsLoading] = useState(safeRedirectPath ? true : false);

  // If the access token is expired, the middleware redirects to this page.
  // If the refresh token is still valid, the user will be redirected to the last page.
  useEffect(() => {
    refreshUser().then((user) => {
      if (user) {
        router.replace(safeRedirectPath);
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  if (isLoading) return <LoadingOverlay overlayProps={{ backgroundOpacity: 1 }} visible />;

  return (
    <>
      <Meta title={t("signin.title")} />
      <SignInForm redirectPath={safeRedirectPath} />
    </>
  );
};
export default SignIn;
