import { LoadingOverlay } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetServerSidePropsContext } from "next";
import { useEffect, useState } from "react";
import Upload from ".";
import showErrorModal from "../../components/share/showErrorModal";
import shareService from "../../services/share.service";
import useTranslate from "../../hooks/useTranslate.hook";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { reverseShareToken: context.params!.reverseShareToken },
  };
}

const Share = ({ reverseShareToken }: { reverseShareToken: string }) => {
  const modals = useModals();
  const t = useTranslate();
  const [isLoading, setIsLoading] = useState(true);

  const [maxShareSize, setMaxShareSize] = useState(0);
  const [reverseShareName, setReverseShareName] = useState("");
  const [reverseShareDescription, setReverseShareDescription] = useState<
    string | undefined
  >(undefined);
  const [reverseShareExpiration, setReverseShareExpiration] = useState<
    Date | undefined
  >(undefined);

  useEffect(() => {
    shareService
      .setReverseShare(reverseShareToken)
      .then((reverseShareTokenData) => {
        setMaxShareSize(reverseShareTokenData.maxShareSize);
        setReverseShareName(reverseShareTokenData.name);
        setReverseShareDescription(reverseShareTokenData.description);
        setReverseShareExpiration(
          reverseShareTokenData.shareExpiration
            ? new Date(reverseShareTokenData.shareExpiration)
            : undefined,
        );
        setIsLoading(false);
      })
      .catch(() => {
        showErrorModal(
          modals,
          t("upload.reverse-share.error.invalid.title"),
          t("upload.reverse-share.error.invalid.description"),
          "go-home",
        );
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <LoadingOverlay visible />;

  return (
    <Upload
      isReverseShare
      maxShareSize={maxShareSize}
      simplified={true}
      reverseShareName={reverseShareName}
      reverseShareDescription={reverseShareDescription}
      reverseShareExpiration={reverseShareExpiration}
    />
  );
};

export default Share;
