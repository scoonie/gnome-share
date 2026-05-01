import { Button } from "@mantine/core";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import toast from "../../utils/toast.util";

const DownloadAllButton = ({ shareId }: { shareId: string }) => {
  const [isZipReady, setIsZipReady] = useState(false);
  const [zipCreationFailed, setZipCreationFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslate();

  const downloadAll = async () => {
    setIsLoading(true);
    await shareService
      .downloadFile(shareId, "zip")
      .then(() => setIsLoading(false));
  };

  useEffect(() => {
    setIsZipReady(false);
    setZipCreationFailed(false);

    shareService
      .getMetaData(shareId)
      .then((share) => {
        setIsZipReady(share.isZipReady);
        setZipCreationFailed(share.zipCreationFailed);
      })
      .catch(() => {});

    const timer = setInterval(() => {
      shareService
        .getMetaData(shareId)
        .then((share) => {
          setIsZipReady(share.isZipReady);
          setZipCreationFailed(share.zipCreationFailed);
          if (share.isZipReady || share.zipCreationFailed) clearInterval(timer);
        })
        .catch(() => clearInterval(timer));
    }, 5000);
    return () => {
      clearInterval(timer);
    };
  }, [shareId]);

  return (
    <Button
      variant="outline"
      loading={isLoading}
      onClick={() => {
        if (zipCreationFailed) {
          toast.error(t("share.notify.download-all-failed"));
        } else if (!isZipReady) {
          toast.error(t("share.notify.download-all-preparing"));
        } else {
          downloadAll();
        }
      }}
    >
      <FormattedMessage id="share.button.download-all" />
    </Button>
  );
};

export default DownloadAllButton;
