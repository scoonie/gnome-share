import { Button, Stack, Text } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "../../../types/modals.type";
import dayjs from "dayjs";
import { useRouter } from "next/router";
import { FormattedMessage } from "react-intl";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import { CompletedShare } from "../../../types/share.type";
import CopyTextField from "../CopyTextField";

const showCompletedUploadModal = (
  modals: ModalsContextProps,
  share: CompletedShare,
  isReverseShare?: boolean,
) => {
  const t = translateOutsideContext();
  const title = isReverseShare
    ? t("upload.reverse-share.complete.title")
    : t("upload.modal.completed.share-ready");
  return modals.openModal({
    closeOnClickOutside: false,
    withCloseButton: false,
    closeOnEscape: false,
    title,
    children: <Body share={share} isReverseShare={!!isReverseShare} />,
  });
};

const Body = ({
  share,
  isReverseShare,
}: {
  share: CompletedShare;
  isReverseShare: boolean;
}) => {
  const modals = useModals();
  const router = useRouter();
  const t = useTranslate();

  const link = `${window.location.origin}/s/${share.id}`;

  if (isReverseShare) {
    return (
      <Stack align="stretch">
        <Text size="sm">
          {t("upload.reverse-share.complete.description")}
        </Text>
        <Button
          onClick={() => {
            modals.closeAll();
            router.reload();
          }}
        >
          <FormattedMessage id="common.button.done" />
        </Button>
      </Stack>
    );
  }

  return (
    <Stack align="stretch">
      <CopyTextField link={link} />
      {share.notifyReverseShareCreator === true && (
        <Text
          size="sm"
          c="dimmed"
        >
          {t("upload.modal.completed.notified-reverse-share-creator")}
        </Text>
      )}
      <Text
        size="xs"
        c="dimmed"
      >
        {/* If our share.expiration is timestamp 0, show a different message */}
        {dayjs(share.expiration).unix() === 0
          ? t("upload.modal.completed.never-expires")
          : t("upload.modal.completed.expires-on", {
              expiration: dayjs(share.expiration).format("LLL"),
            })}
      </Text>

      <Button
        onClick={() => {
          modals.closeAll();
          router.push("/upload");
        }}
      >
        <FormattedMessage id="common.button.done" />
      </Button>
    </Stack>
  );
};

export default showCompletedUploadModal;
