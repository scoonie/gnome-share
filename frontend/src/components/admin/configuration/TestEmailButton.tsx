import { Button, Stack, Text, Textarea } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../../hooks/useTranslate.hook";
import useUser from "../../../hooks/user.hook";
import configService from "../../../services/config.service";
import toast from "../../../utils/toast.util";

const TestEmailButton = ({
  configVariablesChanged,
  saveConfigVariables,
}: {
  configVariablesChanged: boolean;
  saveConfigVariables: () => Promise<void>;
}) => {
  const { user } = useUser();
  const modals = useModals();
  const t = useTranslate();

  const [isLoading, setIsLoading] = useState(false);

  const sendTestEmail = async () => {
    await configService
      .sendTestEmail(user!.email)
      .then(() => toast.success(t("admin.config.smtp.notify.test.success")))
      .catch((e) =>
        modals.openModal({
          title: t("admin.config.smtp.modal.test.error.title"),
          children: (
            <Stack gap="xs">
              <Text size="sm">
                <FormattedMessage id="admin.config.smtp.modal.test.error.description" />
              </Text>
              <Textarea minRows={4} readOnly value={e.response.data.message} />
            </Stack>
          ),
        }),
      );
  };

  return (
    <Button
      loading={isLoading}
      variant="light"
      onClick={async () => {
        if (!configVariablesChanged) {
          setIsLoading(true);
          await sendTestEmail();
          setIsLoading(false);
        } else {
          modals.openConfirmModal({
            title: t("admin.config.smtp.modal.save.title"),
            children: (
              <Text size="sm">
                <FormattedMessage id="admin.config.smtp.modal.save.description" />
              </Text>
            ),
            labels: {
              confirm: t("admin.config.smtp.modal.save.confirm"),
              cancel: t("common.button.cancel"),
            },
            onConfirm: async () => {
              setIsLoading(true);
              await saveConfigVariables();
              await sendTestEmail();
              setIsLoading(false);
            },
          });
        }
      }}
    >
      <FormattedMessage id="admin.config.smtp.button.test" />
    </Button>
  );
};
export default TestEmailButton;
