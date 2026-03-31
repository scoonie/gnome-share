import useTranslate from "../../../hooks/useTranslate.hook";
import Meta from "../../../components/Meta";
import TotpForm from "../../../components/auth/TotpForm";
import { useRouter } from "next/router";
import { safeRedirectPath } from "../../../utils/router.util";

const Totp = () => {
  const t = useTranslate();
  const router = useRouter();

  return (
    <>
      <Meta title={t("totp.title")} />
      <TotpForm redirectPath={safeRedirectPath(router.query.redirect as string | undefined, "/upload")} />
    </>
  );
};

export default Totp;
