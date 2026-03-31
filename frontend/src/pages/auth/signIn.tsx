import { LoadingOverlay } from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SignInForm from "../../components/auth/SignInForm";
import Meta from "../../components/Meta";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import { safeRedirectPath } from "../../utils/router.util";

export function getServerSideProps(context: GetServerSidePropsContext) {
  // Sanitize server-side so tainted user input never reaches the client component
  const redirectPath = safeRedirectPath(context.query.redirect as string | undefined, "/upload");
  return {
    props: { redirectPath },
  };
}

const SignIn = ({ redirectPath }: { redirectPath: string }) => {
  const { refreshUser } = useUser();
  const router = useRouter();
  const t = useTranslate();

  const [isLoading, setIsLoading] = useState(redirectPath !== "/upload");

  // If the access token is expired, the middleware redirects to this page.
  // If the refresh token is still valid, the user will be redirected to the last page.
  useEffect(() => {
    refreshUser().then((user) => {
      if (user) {
        router.replace(safeRedirectPath(redirectPath, "/upload"));
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  if (isLoading) return <LoadingOverlay overlayProps={{ backgroundOpacity: 1 }} visible />;

  return (
    <>
      <Meta title={t("signin.title")} />
      <SignInForm redirectPath={redirectPath} />
    </>
  );
};
export default SignIn;
