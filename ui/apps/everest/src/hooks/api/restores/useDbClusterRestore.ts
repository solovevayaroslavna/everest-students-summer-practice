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
  useMutation,
  UseMutationOptions,
  useQuery,
} from '@tanstack/react-query';
import {
  createDbClusterRestore,
  deleteRestore,
  getDbClusterRestores,
} from 'api/restores';
import { generateShortUID } from 'pages/database-form/database-form-body/steps/first/utils';
import { GetRestorePayload, Restore } from 'shared-types/restores.types';

export const RESTORES_QUERY_KEY = 'restores';

export const useDbClusterRestoreFromBackup = (
  dbClusterName: string,
  options?: UseMutationOptions<unknown, unknown, unknown, unknown>
) =>
  useMutation({
    mutationFn: ({
      backupName,
      namespace,
    }: {
      backupName: string;
      namespace: string;
    }) =>
      createDbClusterRestore(
        {
          apiVersion: 'everest.percona.com/v1alpha1',
          kind: 'DatabaseClusterRestore',
          metadata: {
            name: `restore-${generateShortUID()}`,
          },
          spec: {
            dbClusterName,
            dataSource: {
              dbClusterBackupName: backupName,
            },
          },
        },
        namespace
      ),
    ...options,
  });

export const useDbClusterRestoreFromPointInTime = (
  dbClusterName: string,
  options?: UseMutationOptions<unknown, unknown, unknown, unknown>
) =>
  useMutation({
    mutationFn: ({
      pointInTimeDate,
      backupName,
      namespace,
    }: {
      pointInTimeDate: string;
      backupName: string;
      namespace: string;
    }) =>
      createDbClusterRestore(
        {
          apiVersion: 'everest.percona.com/v1alpha1',
          kind: 'DatabaseClusterRestore',
          metadata: {
            name: `restore-${generateShortUID()}`,
          },
          spec: {
            dbClusterName,
            dataSource: {
              dbClusterBackupName: backupName,
              pitr: {
                date: pointInTimeDate,
              },
            },
          },
        },
        namespace
      ),
    ...options,
  });

export const useDbClusterRestores = (
  namespace: string,
  dbClusterName: string
) =>
  useQuery<GetRestorePayload, unknown, Restore[]>({
    queryKey: [RESTORES_QUERY_KEY, namespace, dbClusterName],
    queryFn: () => getDbClusterRestores(namespace, dbClusterName),
    select: (data) =>
      data.items.map((item) => ({
        name: item.metadata.name,
        startTime: item.metadata.creationTimestamp,
        endTime: item.status.completed,
        state: item.status.state,
        type: item.spec.dataSource.pitr ? 'pitr' : 'full',
      })),
  });

export const useDeleteRestore = (
  namespace: string,
  options?: UseMutationOptions<unknown, unknown, string, unknown>
) =>
  useMutation({
    mutationFn: (restoreName: string) => deleteRestore(namespace, restoreName),
    ...options,
  });
