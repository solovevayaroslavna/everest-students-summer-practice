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

import {
  useQueries,
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import { getDbClustersFn } from 'api/dbClusterApi';
import {
  useNamespacePermissionsForResource,
  useRBACPermissions,
} from 'hooks/rbac';
import { DbCluster, GetDbClusterPayload } from 'shared-types/dbCluster.types';
import { PerconaQueryOptions } from 'shared-types/query.types';
import cronConverter from 'utils/cron-converter';

export interface DbClusterForNamespaceResult {
  namespace: string;
  queryResult: UseQueryResult<DbCluster[], unknown>;
}

export const DB_CLUSTERS_QUERY_KEY = 'dbClusters';

export const dbClustersQuerySelect = ({
  items,
}: GetDbClusterPayload): DbCluster[] =>
  items.map(({ ...props }) => ({
    ...props,
    spec: {
      ...props.spec,
      ...(props.spec?.backup?.schedules && {
        backup: {
          ...props.spec.backup,
          schedules: props.spec.backup.schedules.map((schedule) => ({
            ...schedule,
            schedule: cronConverter(
              schedule.schedule,
              'UTC',
              Intl.DateTimeFormat().resolvedOptions().timeZone
            ),
          })),
        },
      }),
    },
  }));

export const useDbClusters = (
  namespace: string,
  options?: PerconaQueryOptions<GetDbClusterPayload, unknown, DbCluster[]>
) => {
  const { canRead } = useRBACPermissions('database-clusters', `${namespace}/*`);
  return useQuery({
    queryKey: [DB_CLUSTERS_QUERY_KEY],
    queryFn: () => getDbClustersFn(namespace),
    refetchInterval: 5 * 1000,
    select: canRead ? dbClustersQuerySelect : () => [],
    ...options,
    enabled: (options?.enabled ?? true) && canRead,
  });
};

export const useDBClustersForNamespaces = (
  queryParams: Array<{
    namespace: string;
    options?: PerconaQueryOptions<GetDbClusterPayload, unknown, DbCluster[]>;
  }>
) => {
  const { canRead } = useNamespacePermissionsForResource('database-clusters');
  const queries = queryParams.map<
    UseQueryOptions<GetDbClusterPayload, unknown, DbCluster[]>
  >(({ namespace, options }) => {
    const allowed = canRead.includes(namespace);
    const enabled = (options?.enabled ?? true) && allowed;
    return {
      queryKey: [DB_CLUSTERS_QUERY_KEY, namespace],
      retry: false,
      queryFn: () => getDbClustersFn(namespace),
      refetchInterval: 5 * 1000,
      select: allowed ? dbClustersQuerySelect : () => [],
      ...options,
      enabled,
    };
  });

  const queryResults = useQueries({ queries });
  const results: DbClusterForNamespaceResult[] = queryResults.map(
    (item, i) => ({
      namespace: queryParams[i].namespace,
      queryResult: item,
    })
  );

  return results;
};
