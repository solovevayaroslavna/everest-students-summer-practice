import { useContext, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useDeleteSchedule } from 'hooks/api/backups/useScheduledBackups';
import { DB_CLUSTER_QUERY } from 'hooks/api/db-cluster/useDbCluster';
import { ConfirmDialog } from 'components/confirm-dialog/confirm-dialog';
import { ScheduleModalContext } from '../../backups.context';
import { getTimeSelectionPreviewMessage } from 'pages/database-form/database-preview/database.preview.messages';
import { getFormValuesFromCronExpression } from 'components/time-selection/time-selection.utils';
import { Messages } from './backups-list-table-header.messages';
import { useRBACPermissions } from 'hooks/rbac';

const ScheduledBackupsList = ({ canUpdateDb }: { canUpdateDb: boolean }) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const queryClient = useQueryClient();
  const {
    dbCluster,
    setMode: setScheduleModalMode,
    setSelectedScheduleName: setSelectedScheduleToModalContext,
    setOpenScheduleModal,
  } = useContext(ScheduleModalContext);
  const { mutate: deleteSchedule, isPending: deletingSchedule } =
    useDeleteSchedule(dbCluster.metadata.name, dbCluster.metadata.namespace);

  const schedules = dbCluster.spec?.backup?.schedules || [];

  const handleDelete = (scheduleName: string) => {
    setSelectedSchedule(scheduleName);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
  };

  const handleConfirmDelete = (scheduleName: string) => {
    deleteSchedule(scheduleName, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [DB_CLUSTER_QUERY, dbCluster.metadata.name],
        });
        handleCloseDeleteDialog();
      },
    });
  };

  const handleEdit = (scheduleName: string) => {
    setScheduleModalMode('edit');
    setSelectedScheduleToModalContext(scheduleName);
    setOpenScheduleModal(true);
  };

  const { canUpdate: canUpdateBackups, canDelete: canDeleteBackups } =
    useRBACPermissions(
      'database-cluster-backups',
      `${dbCluster.metadata.namespace}/${dbCluster.metadata.name}`
    );

  return (
    <Stack
      useFlexGap
      spacing={1}
      width="100%"
      order={3}
      bgcolor={(theme) => theme.palette.surfaces?.elevation0}
      p={2}
      mt={2}
    >
      {schedules.map((item) => (
        <Paper
          key={`schedule-${item?.name}`}
          sx={{
            py: 1,
            px: 2,
            borderRadius: 1,
            boxShadow: 'none',
          }}
          data-testid={`schedule-${item?.schedule}`}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Box sx={{ width: '40%' }}>
              <Stack>
                <Typography variant="body1">{item.name}</Typography>
                <Typography variant="body2">
                  {getTimeSelectionPreviewMessage(
                    getFormValuesFromCronExpression(item.schedule)
                  )}
                </Typography>
              </Stack>
            </Box>
            <Box sx={{ width: '30%' }}>
              <Typography variant="body2">
                {`Retention copies: 
                ${item?.retentionCopies || 'infinite'}`}
              </Typography>
            </Box>
            <Box sx={{ width: '15%' }}>
              {' '}
              <Typography variant="body2">
                {' '}
                {`Storage: ${item.backupStorageName}`}
              </Typography>
            </Box>
            <Box display="flex">
              {canUpdateDb && canUpdateBackups && (
                <IconButton
                  color="primary"
                  disabled={!dbCluster.spec.backup?.enabled}
                  onClick={() => handleEdit(item.name)}
                  data-testid="edit-schedule-button"
                >
                  <EditOutlinedIcon />
                </IconButton>
              )}
              {canUpdateDb && canDeleteBackups && (
                <IconButton
                  color="primary"
                  disabled={!dbCluster.spec.backup?.enabled}
                  onClick={() => handleDelete(item.name)}
                  data-testid="delete-schedule-button"
                >
                  <DeleteOutlineOutlinedIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </Paper>
      ))}
      {openDeleteDialog && (
        <ConfirmDialog
          isOpen={openDeleteDialog}
          selectedId={selectedSchedule}
          closeModal={handleCloseDeleteDialog}
          headerMessage={Messages.deleteModal.header}
          handleConfirm={handleConfirmDelete}
          disabledButtons={deletingSchedule}
        >
          {Messages.deleteModal.content(selectedSchedule)}
        </ConfirmDialog>
      )}
    </Stack>
  );
};

export default ScheduledBackupsList;
