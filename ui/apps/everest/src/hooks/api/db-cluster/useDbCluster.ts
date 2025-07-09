// everest
// Copyright (C) 2023 Percona LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { useQuery } from '@tanstack/react-query';
import { DbCluster } from 'shared-types/dbCluster.types';

import { getDbClusterFn, getDbClusterImports } from 'api/dbClusterApi';
import { PerconaQueryOptions } from 'shared-types/query.types';
import { useRBACPermissions } from 'hooks/rbac';
import { mergeNewDbClusterData } from 'utils/db';
import { DataImportJobs } from 'shared-types/dataImporters.types';

export const DB_CLUSTER_QUERY = 'dbCluster';
export const DB_CLUSTER_IMPORTS_QUERY = 'dbClusterImports';

export const useDbCluster = (
  dbClusterName: string,
  namespace: string,
  options?: PerconaQueryOptions<DbCluster, unknown, DbCluster>
) => {
  const { canRead } = useRBACPermissions(
    'database-clusters',
    `${namespace}/${dbClusterName}`
  );
  return useQuery<DbCluster, unknown, DbCluster>({
    queryKey: [DB_CLUSTER_QUERY, dbClusterName],
    queryFn: () => getDbClusterFn(dbClusterName, namespace),
    ...options,
    select: (cluster: DbCluster) => {
      const transformedCluster: DbCluster = options?.select
        ? options.select(cluster)
        : cluster;

      return mergeNewDbClusterData(undefined, transformedCluster, true);
    },
    enabled: (options?.enabled ?? true) && canRead,
  });
};

export const useDbClusterImportJobs = (
  namespace: string,
  dbClusterName: string,
  options?: PerconaQueryOptions<DataImportJobs, unknown, DataImportJobs>
) => {
  return useQuery<DataImportJobs, unknown, DataImportJobs>({
    queryKey: [DB_CLUSTER_IMPORTS_QUERY, dbClusterName],
    refetchInterval: 5 * 1000,
    queryFn: () => getDbClusterImports(namespace, dbClusterName),
    ...options,
  });
};
