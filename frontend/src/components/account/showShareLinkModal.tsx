import { Stack, TextInput } from "@mantine/core";
import { ModalsContextProps } from "../../types/modals.type";
import { translateOutsideContext } from "../../hooks/useTranslate.hook";

const showShareLinkModal = (modals: ModalsContextProps, shareId: string) => {
  const t = translateOutsideContext();
  const link = `${window.location.origin}/s/${shareId}`;
  return modals.openModal({
    title: t("account.shares.modal.share-link"),
    children: (
      <Stack align="stretch">
        <TextInput variant="filled" value={link} />
      </Stack>
    ),
  });
};

export default showShareLinkModal;
