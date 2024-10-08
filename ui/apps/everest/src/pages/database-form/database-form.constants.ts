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
import { DbWizardFormFields } from 'consts.ts';
import { DbWizardType } from './database-form-schema.ts';
import {
  DEFAULT_SIZES,
  ResourceSize,
} from 'components/cluster-form/resources/constants.ts';

export const DB_WIZARD_DEFAULTS: DbWizardType = {
  // TODO should be changed to true after  https://jira.percona.com/browse/EVEREST-509
  [DbWizardFormFields.schedules]: [],
  [DbWizardFormFields.pitrEnabled]: false,
  [DbWizardFormFields.pitrStorageLocation]: null,
  // @ts-ignore
  [DbWizardFormFields.storageLocation]: null,
  [DbWizardFormFields.dbType]: '' as DbType,
  [DbWizardFormFields.dbName]: '',
  [DbWizardFormFields.dbVersion]: '',
  [DbWizardFormFields.storageClass]: '',
  [DbWizardFormFields.k8sNamespace]: null,
  [DbWizardFormFields.externalAccess]: false,
  // [DbWizardFormFields.internetFacing]: true,
  [DbWizardFormFields.sourceRanges]: [{ sourceRange: '' }],
  [DbWizardFormFields.engineParametersEnabled]: false,
  [DbWizardFormFields.engineParameters]: '',
  [DbWizardFormFields.monitoring]: false,
  [DbWizardFormFields.monitoringInstance]: '',
  [DbWizardFormFields.numberOfNodes]: '1',
  [DbWizardFormFields.numberOfProxies]: '1',
  [DbWizardFormFields.resourceSizePerNode]: ResourceSize.small,
  [DbWizardFormFields.resourceSizePerProxy]: ResourceSize.small,
  [DbWizardFormFields.customNrOfNodes]: '1',
  [DbWizardFormFields.customNrOfProxies]: '1',
  [DbWizardFormFields.cpu]: DEFAULT_SIZES.small.cpu,
  [DbWizardFormFields.proxyCpu]: DEFAULT_SIZES.small.cpu,
  [DbWizardFormFields.disk]: DEFAULT_SIZES.small.disk,
  [DbWizardFormFields.diskUnit]: 'Gi',
  [DbWizardFormFields.memory]: DEFAULT_SIZES.small.memory,
  [DbWizardFormFields.proxyMemory]: DEFAULT_SIZES.small.memory,
  [DbWizardFormFields.sharding]: false,
  [DbWizardFormFields.shardNr]: '1',
  [DbWizardFormFields.shardConfigServers]: '1',
};

export const NODES_DB_TYPE_MAP: Record<DbType, string[]> = {
  [DbType.Mongo]: ['1', '3', '5'],
  [DbType.Mysql]: ['1', '3', '5'],
  [DbType.Postresql]: ['1', '2', '3'],
};
