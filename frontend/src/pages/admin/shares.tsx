import { Group, Pagination, Space, Text, Title } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import ManageShareTable from "../../components/admin/shares/ManageShareTable";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { MyShare } from "../../types/share.type";
import toast from "../../utils/toast.util";

const PAGE_LIMIT = 25;

const Shares = () => {
  const [shares, setShares] = useState<MyShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const modals = useModals();
  const t = useTranslate();

  const getShares = (currentPage: number) => {
    setIsLoading(true);
    shareService.list(currentPage, PAGE_LIMIT).then(({ shares, total }) => {
      setShares(shares);
      setTotal(total);
      setIsLoading(false);
    });
  };

  const deleteShare = (share: MyShare) => {
    modals.openConfirmModal({
      title: t("admin.shares.edit.delete.title", {
        id: share.id,
      }),
      children: (
        <Text size="sm">
          <FormattedMessage id="admin.shares.edit.delete.description" />
        </Text>
      ),
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        shareService
          .remove(share.id)
          .then(() => {
            setShares(shares.filter((v) => v.id != share.id));
            setTotal((t) => t - 1);
          })
          .catch(toast.axiosError);
      },
    });
  };

  useEffect(() => {
    getShares(page);
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <>
      <Meta title={t("admin.shares.title")} />
      <Group justify="space-between" align="baseline" mb={20}>
        <Title mb={30} order={3}>
          <FormattedMessage id="admin.shares.title" />
        </Title>
      </Group>

      <ManageShareTable
        shares={shares}
        deleteShare={deleteShare}
        isLoading={isLoading}
      />
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            value={page}
            onChange={setPage}
            total={totalPages}
          />
        </Group>
      )}
      <Space h="xl" />
    </>
  );
};

export default Shares;
