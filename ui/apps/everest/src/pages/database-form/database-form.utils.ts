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

import { DbType } from '@percona/types';
import { DbCluster, ProxyExposeType } from 'shared-types/dbCluster.types';
import { DbWizardMode } from './database-form.types';
import { DbWizardFormFields } from 'consts.ts';
import { dbEngineToDbType } from '@percona/utils';

import { cpuParser, memoryParser } from 'utils/k8ResourceParser';
import { generateShortUID } from './database-form-body/steps/first/utils.ts';
import { MAX_DB_CLUSTER_NAME_LENGTH } from 'consts';
import { DbWizardType } from './database-form-schema.ts';
import { DB_WIZARD_DEFAULTS } from './database-form.constants.ts';
import {
  CUSTOM_NR_UNITS_INPUT_VALUE,
  matchFieldsValueToResourceSize,
  NODES_DB_TYPE_MAP,
  SHARDING_DEFAULTS,
} from 'components/cluster-form';

const replicasToNodes = (replicas: string, dbType: DbType): string => {
  const nodeOptions = NODES_DB_TYPE_MAP[dbType];
  const replicasString = replicas.toString();

  if (nodeOptions.includes(replicasString)) {
    return replicasString;
  }

  return CUSTOM_NR_UNITS_INPUT_VALUE;
};

export const DbClusterPayloadToFormValues = (
  dbCluster: DbCluster,
  mode: DbWizardMode,
  namespace: string
): DbWizardType => {
  const backup = dbCluster?.spec?.backup;
  const replicas = dbCluster?.spec?.proxy?.replicas.toString();
  const proxies = dbCluster?.spec?.proxy?.replicas.toString();
  const diskValues = memoryParser(
    dbCluster?.spec?.engine?.storage?.size.toString()
  );

  const sharding = dbCluster?.spec?.sharding;

  return {
    //basic info
    [DbWizardFormFields.k8sNamespace]:
      namespace || DB_WIZARD_DEFAULTS[DbWizardFormFields.k8sNamespace],
    [DbWizardFormFields.dbType]: dbEngineToDbType(
      dbCluster?.spec?.engine?.type
    ),
    [DbWizardFormFields.dbName]:
      mode === 'restoreFromBackup'
        ? `restored-${dbCluster?.metadata?.name}-${generateShortUID()}`.slice(
            0,
            MAX_DB_CLUSTER_NAME_LENGTH
          )
        : dbCluster?.metadata?.name,
    [DbWizardFormFields.dbVersion]: dbCluster?.spec?.engine?.version || '',
    [DbWizardFormFields.externalAccess]:
      dbCluster?.spec?.proxy?.expose?.type === ProxyExposeType.external,
    // [DbWizardFormFields.internetFacing]: true,
    [DbWizardFormFields.engineParametersEnabled]:
      !!dbCluster?.spec?.engine?.config,
    [DbWizardFormFields.engineParameters]: dbCluster?.spec?.engine?.config,
    [DbWizardFormFields.sourceRanges]: dbCluster?.spec?.proxy?.expose
      ?.ipSourceRanges
      ? dbCluster?.spec?.proxy?.expose?.ipSourceRanges.map((item) => ({
          sourceRange: item,
        }))
      : [{ sourceRange: '' }],
    [DbWizardFormFields.monitoring]:
      !!dbCluster?.spec?.monitoring?.monitoringConfigName,
    [DbWizardFormFields.monitoringInstance]:
      dbCluster?.spec?.monitoring?.monitoringConfigName || '',
    [DbWizardFormFields.numberOfNodes]: replicasToNodes(
      replicas,
      dbEngineToDbType(dbCluster?.spec?.engine?.type)
    ),
    [DbWizardFormFields.numberOfProxies]: replicasToNodes(
      proxies,
      dbEngineToDbType(dbCluster?.spec?.engine?.type)
    ),
    [DbWizardFormFields.customNrOfNodes]: replicas,
    [DbWizardFormFields.customNrOfProxies]: proxies,
    [DbWizardFormFields.resourceSizePerNode]: matchFieldsValueToResourceSize(
      dbCluster?.spec?.engine?.resources
    ),
    [DbWizardFormFields.resourceSizePerProxy]: matchFieldsValueToResourceSize(
      dbCluster?.spec?.proxy.resources
    ),
    [DbWizardFormFields.sharding]: dbCluster?.spec?.sharding?.enabled || false,
    [DbWizardFormFields.shardConfigServers]: (
      sharding?.configServer?.replicas ||
      SHARDING_DEFAULTS[DbWizardFormFields.shardConfigServers].min
    ).toString(),
    [DbWizardFormFields.shardNr]: (
      sharding?.shards || SHARDING_DEFAULTS[DbWizardFormFields.shardNr].min
    ).toString(),
    [DbWizardFormFields.cpu]: cpuParser(
      dbCluster?.spec?.engine?.resources?.cpu.toString() || '0'
    ),
    [DbWizardFormFields.proxyCpu]: cpuParser(
      dbCluster?.spec?.proxy?.resources?.cpu.toString() || '0'
    ),
    [DbWizardFormFields.disk]: diskValues.value,
    [DbWizardFormFields.diskUnit]: diskValues.originalUnit,
    [DbWizardFormFields.memory]: memoryParser(
      (dbCluster?.spec?.engine?.resources?.memory || 0).toString()
    ).value,
    [DbWizardFormFields.proxyMemory]: memoryParser(
      (dbCluster?.spec?.proxy?.resources?.memory || 0).toString()
    ).value,
    [DbWizardFormFields.storageClass]:
      dbCluster?.spec?.engine?.storage?.class || null,

    //backups
    [DbWizardFormFields.backupsEnabled]: !!backup?.enabled,
    [DbWizardFormFields.pitrEnabled]: backup?.pitr?.enabled || false,
    [DbWizardFormFields.pitrStorageLocation]:
      (backup?.pitr?.enabled && mode === 'new') || mode === 'edit'
        ? backup?.pitr?.backupStorageName || null
        : DB_WIZARD_DEFAULTS[DbWizardFormFields.pitrStorageLocation],
    [DbWizardFormFields.schedules]: backup?.schedules || [],
  };
};
