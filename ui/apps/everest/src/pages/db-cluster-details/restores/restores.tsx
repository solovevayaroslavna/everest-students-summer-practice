import { useParams } from 'react-router-dom';
import { Alert, MenuItem, capitalize } from '@mui/material';
import { Delete } from '@mui/icons-material';
import { MRT_ColumnDef } from 'material-react-table';
import { format } from 'date-fns';
import { Table } from '@percona/ui-lib';
import { DATE_FORMAT } from 'consts';
import { StatusField } from 'components/status-field/status-field';
import { ConfirmDialog } from 'components/confirm-dialog/confirm-dialog';
import { useDbClusterPitr } from 'hooks/api/backups/useBackups';
import {
  PG_STATUS,
  PSMDB_STATUS,
  PXC_STATUS,
  Restore,
} from 'shared-types/restores.types';
import { Messages } from './restores.messages';
import {
  RESTORES_QUERY_KEY,
  useDbClusterRestores,
  useDeleteRestore,
} from 'hooks/api/restores/useDbClusterRestore';
import { useMemo, useState } from 'react';
import { RESTORE_STATUS_TO_BASE_STATUS } from './restores.constants';
import { useQueryClient } from '@tanstack/react-query';

const Restores = () => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedRestore, setSelectedRestore] = useState('');
  const { dbClusterName, namespace = '' } = useParams();
  const queryClient = useQueryClient();
  const { data: pitrData } = useDbClusterPitr(dbClusterName!, namespace, {
    enabled: !!dbClusterName && !!namespace,
  });
  const { data: restores = [], isLoading: loadingRestores } =
    useDbClusterRestores(namespace, dbClusterName!);
  const { mutate: deleteRestore, isPending: deletingRestore } =
    useDeleteRestore(namespace);

  const columns = useMemo<MRT_ColumnDef<Restore>[]>(() => {
    return [
      {
        header: 'Status',
        accessorKey: 'state',
        Cell: ({ cell }) => (
          <StatusField
            status={cell.getValue<PXC_STATUS | PSMDB_STATUS | PG_STATUS>()}
            statusMap={RESTORE_STATUS_TO_BASE_STATUS}
          >
            {capitalize(cell.getValue<PXC_STATUS | PSMDB_STATUS | PG_STATUS>())}
          </StatusField>
        ),
      },
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Started',
        accessorKey: 'startTime',
        Cell: ({ cell }) =>
          cell.getValue<Date>()
            ? format(new Date(cell.getValue<Date>()), DATE_FORMAT)
            : '-----',
      },
      {
        header: 'Finished',
        accessorKey: 'endTime',
        Cell: ({ cell }) =>
          cell.getValue<Date>()
            ? format(new Date(cell.getValue<Date>()), DATE_FORMAT)
            : '-----',
      },
      {
        header: 'Type',
        accessorKey: 'type',
        Cell: ({ cell }) => (cell.getValue() === 'pitr' ? 'PITR' : 'Full'),
      },
    ];
  }, []);

  const handleDeleteBackup = (restoreName: string) => {
    setSelectedRestore(restoreName);
    setOpenDeleteDialog(true);
  };

  const handleConfirmDelete = (restoreName: string) => {
    deleteRestore(restoreName, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [RESTORES_QUERY_KEY, namespace, dbClusterName],
        });
        setOpenDeleteDialog(false);
      },
    });
  };

  return (
    <>
      {pitrData?.gaps && <Alert severity="error">{Messages.pitrError}</Alert>}
      <Table
        state={{ isLoading: loadingRestores }}
        tableName={`${dbClusterName}-restore`}
        columns={columns}
        data={restores}
        noDataMessage="No restores"
        enableRowActions
        renderRowActionMenuItems={({ row, closeMenu }) => [
          <MenuItem
            key={2}
            onClick={() => {
              handleDeleteBackup(row.original.name);
              closeMenu();
            }}
            sx={{ m: 0 }}
          >
            <Delete />
            Delete
          </MenuItem>,
        ]}
      />
      {openDeleteDialog && (
        <ConfirmDialog
          isOpen={openDeleteDialog}
          selectedId={selectedRestore}
          closeModal={() => setOpenDeleteDialog(false)}
          headerMessage={Messages.deleteDialog.header}
          handleConfirm={handleConfirmDelete}
          disabledButtons={deletingRestore}
        >
          {Messages.deleteDialog.content(selectedRestore)}
        </ConfirmDialog>
      )}
    </>
  );
};

export default Restores;
