import { GetServerSidePropsContext } from "next";
import useTranslate from "../../../hooks/useTranslate.hook";
import Meta from "../../../components/Meta";
import TotpForm from "../../../components/auth/TotpForm";
import { safeRedirectPath } from "../../../utils/router.util";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: {
      redirectPath: safeRedirectPath(context.query.redirect as string | undefined, "/upload"),
    },
  };
}

const Totp = ({ redirectPath }: { redirectPath: string }) => {
  const t = useTranslate();

  return (
    <>
      <Meta title={t("totp.title")} />
      <TotpForm redirectPath={redirectPath} />
    </>
  );
};

export default Totp;
