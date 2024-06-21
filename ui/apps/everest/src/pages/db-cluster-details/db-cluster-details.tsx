import { Alert, Box, Skeleton, Tab, Tabs } from '@mui/material';
import {
  Link,
  Outlet,
  useMatch,
  useNavigate,
  useParams,
} from 'react-router-dom';
import StatusField from 'components/status-field/status-field';
import { beautifyDbClusterStatus } from 'pages/databases/DbClusterView.utils';
import { DB_CLUSTER_STATUS_TO_BASE_STATUS } from 'pages/databases/DbClusterView.constants';
import { NoMatch } from '../404/NoMatch';
import BackNavigationText from 'components/back-navigation-text';
import { DbActionButton } from './db-action-button';
import { Messages } from './db-cluster-details.messages';
import { DBClusterDetailsTabs } from './db-cluster-details.types';
import { DbClusterStatus } from 'shared-types/dbCluster.types';
import { useDbCluster } from 'hooks/api/db-cluster/useDbCluster';

export const DbClusterDetails = () => {
  const { dbClusterName = '', namespace = '' } = useParams();
  const { data: dbCluster, isLoading } = useDbCluster(
    dbClusterName,
    namespace,
    {
      enabled: !!namespace && !!dbClusterName,
    }
  );
  const routeMatch = useMatch('/databases/:namespace/:dbClusterName/:tabs');
  const navigate = useNavigate();
  const currentTab = routeMatch?.params?.tabs;

  if (isLoading) {
    return (
      <>
        <Skeleton variant="rectangular" />
        <Skeleton variant="rectangular" />
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton variant="rectangular" />
      </>
    );
  }

  // We went through the array and know the cluster is not there. Safe to show 404
  if (!dbCluster) {
    return <NoMatch />;
  }

  // All clear, show the cluster data
  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          mb: 1,
        }}
      >
        <BackNavigationText
          text={dbClusterName!}
          onBackClick={() => navigate('/databases')}
        />
        {/* At this point, loading is done and we either have the cluster or not */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <DbActionButton dbCluster={dbCluster} />
          {dbCluster.status?.status && (
            <StatusField
              dataTestId={dbClusterName}
              status={dbCluster.status.status}
              statusMap={DB_CLUSTER_STATUS_TO_BASE_STATUS}
            >
              {beautifyDbClusterStatus(dbCluster.status.status)}
            </StatusField>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 1,
        }}
      >
        <Tabs
          value={currentTab}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="nav tabs"
        >
          {Object.keys(DBClusterDetailsTabs).map((item) => (
            <Tab
              // @ts-ignore
              label={Messages[item]}
              // @ts-ignore
              key={DBClusterDetailsTabs[item]}
              // @ts-ignore
              value={DBClusterDetailsTabs[item]}
              // @ts-ignore
              to={DBClusterDetailsTabs[item]}
              component={Link}
              data-testid={`${
                DBClusterDetailsTabs[item as DBClusterDetailsTabs]
              }`}
            />
          ))}
        </Tabs>
      </Box>
      {dbCluster.status?.status === DbClusterStatus.restoring && (
        <Alert severity="warning" sx={{ my: 1 }}>
          {Messages.restoringDb}
        </Alert>
      )}
      <Outlet />
    </Box>
  );
};
