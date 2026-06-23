import {
  Button,
  Checkbox,
  Group,
  Stack,
  TagsInput,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useModals } from "@mantine/modals";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import shareService from "../../../services/share.service";
import { ModalsContextProps } from "../../../types/modals.type";
import { MyReverseShare } from "../../../types/share.type";
import toast from "../../../utils/toast.util";

const showEditReverseShareModal = (
  modals: ModalsContextProps,
  reverseShare: MyReverseShare,
  getReverseShares: () => void,
) => {
  const t = translateOutsideContext();
  return modals.openModal({
    title: t("account.reverseShares.modal.edit.title"),
    children: (
      <Body reverseShare={reverseShare} getReverseShares={getReverseShares} />
    ),
  });
};

const Body = ({
  reverseShare,
  getReverseShares,
}: {
  reverseShare: MyReverseShare;
  getReverseShares: () => void;
}) => {
  const modals = useModals();
  const t = useTranslate();

  const [showAdvanced, setShowAdvanced] = useState(
    (reverseShare.viewerEmails?.length ?? 0) > 0,
  );

  const form = useForm({
    initialValues: {
      viewerEmails: reverseShare.viewerEmails ?? [],
    },
  });

  const onSubmit = form.onSubmit(async (values) => {
    shareService
      .updateReverseShare(reverseShare.id, {
        viewerEmails: values.viewerEmails,
      })
      .then(() => {
        modals.closeAll();
        getReverseShares();
        toast.success(t("common.notify.saved"));
      })
      .catch(toast.axiosError);
  });

  return (
    <Group>
      <form onSubmit={onSubmit}>
        <Stack align="stretch">
          <Text size="sm">{reverseShare.name}</Text>
          <Checkbox
            label={t("account.reverseShares.modal.show-advanced")}
            checked={showAdvanced}
            onChange={(event) => setShowAdvanced(event.currentTarget.checked)}
          />
          {showAdvanced && (
            <TagsInput
              variant="filled"
              label={t("account.reverseShares.modal.viewer-emails.label")}
              placeholder={t(
                "account.reverseShares.modal.viewer-emails.placeholder",
              )}
              description={t(
                "account.reverseShares.modal.viewer-emails.description",
              )}
              {...form.getInputProps("viewerEmails")}
            />
          )}
          <Button mt="md" type="submit">
            <FormattedMessage id="common.button.save" />
          </Button>
        </Stack>
      </form>
    </Group>
  );
};

export default showEditReverseShareModal;
