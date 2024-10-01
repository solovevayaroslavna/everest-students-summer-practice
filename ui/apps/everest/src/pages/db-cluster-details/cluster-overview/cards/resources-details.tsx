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

import { useState } from 'react';
import { DatabaseIcon, OverviewCard } from '@percona/ui-lib';
import { Button, Stack } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useQueryClient } from '@tanstack/react-query';
import { SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import {
  CUSTOM_NR_UNITS_INPUT_VALUE,
  matchFieldsValueToResourceSize,
  NODES_DB_TYPE_MAP,
  resourcesFormSchema,
} from 'components/cluster-form';
import OverviewSection from '../overview-section';
import { ResourcesDetailsOverviewProps } from './card.types';
import OverviewSectionRow from '../overview-section-row';
import { Messages } from '../cluster-overview.messages';
import { ResourcesEditModal } from './resources';
import {
  cpuParser,
  getTotalResourcesDetailedString,
  memoryParser,
} from 'utils/k8ResourceParser';
import { dbEngineToDbType } from '@percona/utils';
import { DB_CLUSTER_QUERY, useUpdateDbClusterResources } from 'hooks';
import { DbType } from '@percona/types';

export const ResourcesDetails = ({
  dbCluster,
  loading,
  sharding,
}: ResourcesDetailsOverviewProps) => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const { mutate: updateDbClusterResources } = useUpdateDbClusterResources();
  const queryClient = useQueryClient();
  const cpu = dbCluster.spec.engine.resources?.cpu || 0;
  const proxyCpu = dbCluster.spec.proxy.resources?.cpu || 0;
  const memory = dbCluster.spec.engine.resources?.memory || 0;
  const proxyMemory = dbCluster.spec.proxy.resources?.memory || 0;
  const disk = dbCluster.spec.engine.storage.size;
  const parsedDiskValues = memoryParser(disk.toString());
  const parsedMemoryValues = memoryParser(memory.toString());
  const dbType = dbEngineToDbType(dbCluster.spec.engine.type);
  const replicas = dbCluster.spec.engine.replicas.toString();
  const proxies = dbCluster.spec.proxy.replicas.toString();
  const numberOfNodes = NODES_DB_TYPE_MAP[dbType].includes(replicas)
    ? replicas
    : CUSTOM_NR_UNITS_INPUT_VALUE;
  const numberOfProxies = NODES_DB_TYPE_MAP[dbType].includes(proxies)
    ? proxies
    : CUSTOM_NR_UNITS_INPUT_VALUE;

  const onSubmit: SubmitHandler<
    z.infer<ReturnType<typeof resourcesFormSchema>>
  > = ({
    cpu,
    disk,
    diskUnit,
    memory,
    proxyCpu,
    proxyMemory,
    numberOfNodes,
    numberOfProxies,
    customNrOfNodes,
    customNrOfProxies,
  }) => {
    updateDbClusterResources(
      {
        dbCluster,
        newResources: {
          cpu,
          disk,
          diskUnit,
          memory,
          proxyCpu,
          proxyMemory,
          numberOfProxies: parseInt(
            numberOfProxies === CUSTOM_NR_UNITS_INPUT_VALUE
              ? customNrOfProxies || '1'
              : numberOfProxies,
            10
          ),
          numberOfNodes: parseInt(
            numberOfNodes === CUSTOM_NR_UNITS_INPUT_VALUE
              ? customNrOfNodes || '1'
              : numberOfNodes,
            10
          ),
        },
      },
      {
        onSuccess: () => {
          setOpenEditModal(false);
          queryClient.invalidateQueries({
            queryKey: [DB_CLUSTER_QUERY, dbCluster.metadata.name],
          });
        },
      }
    );
  };

  return (
    <>
      <OverviewCard
        dataTestId="resources"
        cardHeaderProps={{
          title: Messages.titles.resources,
          avatar: <DatabaseIcon />,
          action: (
            <Button
              size="small"
              startIcon={<EditOutlinedIcon />}
              onClick={() => setOpenEditModal(true)}
            >
              Edit
            </Button>
          ),
        }}
      >
        <Stack gap={3}>
          {dbType === DbType.Mongo && (
            <OverviewSection title={'Sharding'} loading={loading}>
              <OverviewSectionRow
                label={Messages.fields.status}
                contentString={
                  sharding?.enabled
                    ? Messages.fields.enabled
                    : Messages.fields.disabled
                }
              />
              {sharding?.enabled && (
                <OverviewSectionRow
                  label={Messages.fields.shards}
                  contentString={sharding?.shards?.toString()}
                />
              )}
              {sharding?.enabled && (
                <OverviewSectionRow
                  label={Messages.fields.configServers}
                  contentString={sharding?.configServer?.replicas?.toString()}
                />
              )}
            </OverviewSection>
          )}
          <OverviewSection
            title={`${replicas} node${+replicas > 1 ? 's' : ''}`}
            loading={loading}
          >
            <OverviewSectionRow
              label={Messages.fields.cpu}
              contentString={getTotalResourcesDetailedString(
                cpuParser(cpu.toString() || '0'),
                parseInt(replicas, 10),
                'CPU'
              )}
            />
            <OverviewSectionRow
              label={Messages.fields.memory}
              contentString={getTotalResourcesDetailedString(
                parsedMemoryValues.value,
                parseInt(replicas, 10),
                parsedMemoryValues.originalUnit
              )}
            />
            <OverviewSectionRow
              label={Messages.fields.disk}
              contentString={getTotalResourcesDetailedString(
                parsedDiskValues.value,
                parseInt(replicas, 10),
                parsedDiskValues.originalUnit
              )}
            />
          </OverviewSection>
        </Stack>
      </OverviewCard>
      {openEditModal && (
        <ResourcesEditModal
          dbType={dbType}
          handleCloseModal={() => setOpenEditModal(false)}
          onSubmit={onSubmit}
          defaultValues={{
            cpu: cpuParser(cpu.toString() || '0'),
            disk: parsedDiskValues.value,
            diskUnit: parsedDiskValues.originalUnit,
            memory: parsedMemoryValues.value,
            proxyCpu: cpuParser(proxyCpu.toString() || '0'),
            proxyMemory: memoryParser(proxyMemory.toString()).value,
            numberOfNodes,
            numberOfProxies,
            customNrOfNodes: replicas,
            customNrOfProxies: proxies,
            resourceSizePerNode: matchFieldsValueToResourceSize(
              dbCluster.spec.engine.resources
            ),
            resourceSizePerProxy: matchFieldsValueToResourceSize(
              dbCluster.spec.proxy.resources
            ),
          }}
        />
      )}
    </>
  );
};
