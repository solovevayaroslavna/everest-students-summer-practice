import { Box, Button, Typography } from '@mui/material';
import { UpgradeHeaderProps } from './types';
import { Messages } from './messages';

const UpgradeHeader = ({
  upgradeAvailable,
  pendingUpgradeTasks,
  onUpgrade,
  ...boxProps
}: UpgradeHeaderProps) => {
  if (!upgradeAvailable) {
    return null;
  }

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      {...boxProps}
    >
      <Typography variant="body1">
        A new version of the operators is available.
        {pendingUpgradeTasks
          ? 'Start upgrading by performing all the pending tasks in the Actions column.'
          : ''}
      </Typography>
      <Button
        size="medium"
        variant="contained"
        onClick={onUpgrade}
        disabled={pendingUpgradeTasks}
      >
        {Messages.upgradeOperators}
      </Button>
    </Box>
  );
};

export default UpgradeHeader;
