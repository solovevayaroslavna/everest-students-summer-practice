import { useDbBackups, useDbClusterPitr } from 'hooks/api/backups/useBackups';
import { LastBackupProps } from './LastBackup.types';
import { IconButton, Tooltip, Typography } from '@mui/material';
import { Messages } from '../dbClusterView.messages';
import {
  getLastBackupStatus,
  getLastBackupTimeDiff,
  sortBackupsByTime,
} from '../DbClusterView.utils';
import { WarningIcon } from '@percona/ui-lib';
import { BackupStatus } from 'shared-types/backups.types';
import { useDbCluster } from 'hooks/api/db-cluster/useDbCluster';

export const LastBackup = ({ dbName, namespace }: LastBackupProps) => {
  const { data: backups = [] } = useDbBackups(dbName!, namespace, {
    enabled: !!dbName,
    refetchInterval: 10 * 1000,
  });

  const { data: pitrData } = useDbClusterPitr(dbName, namespace);
  const { data: dbCluster } = useDbCluster(dbName, namespace);

  const schedules = dbCluster?.spec.backup?.schedules || [];

  const finishedBackups = backups.filter(
    (backup) => backup.completed && backup.state === BackupStatus.OK
  );
  const sortedBackups = sortBackupsByTime(finishedBackups);
  const lastFinishedBackup = sortedBackups[sortedBackups.length - 1];
  const lastFinishedBackupDate = lastFinishedBackup?.completed || new Date();

  return (
    <>
      {finishedBackups.length ? (
        <>
          <Typography variant="body2">
            {getLastBackupTimeDiff(lastFinishedBackupDate)}
          </Typography>
          {pitrData?.gaps && (
            <Tooltip
              title={Messages.lastBackup.warningTooltip}
              placement="right"
              arrow
            >
              <IconButton>
                <WarningIcon />
              </IconButton>
            </Tooltip>
          )}
        </>
      ) : (
        <Typography variant="body2">
          {getLastBackupStatus(sortedBackups, schedules)}
        </Typography>
      )}
    </>
  );
};
