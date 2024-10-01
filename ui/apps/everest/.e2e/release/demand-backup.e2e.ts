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

import { expect, test } from '@playwright/test';
import {
  deleteDbCluster,
  gotoDbClusterBackups,
  gotoDbClusterRestores,
} from '../utils/db-clusters-list';
import { getTokenFromLocalStorage } from '../utils/localStorage';
import { getClusterDetailedInfo } from '../utils/storage-class';
import {
  moveForward,
  submitWizard,
  populateBasicInformation,
  populateResources,
  populateAdvancedConfig,
  populateMonitoringModalForm,
} from '../utils/db-wizard';
import { EVEREST_CI_NAMESPACES } from '../constants';
import {
  waitForStatus,
  waitForDelete,
  findRowAndClickActions,
} from '../utils/table';
import { checkError } from '../utils/generic';
import {
  deleteMonitoringInstance,
  listMonitoringInstances,
} from '../utils/monitoring-instance';
import { clickOnDemandBackup } from '../db-cluster-details/utils';
import { prepareTestDB, dropTestDB, queryTestDB } from '../utils/db-cmd-line';

const {
  MONITORING_URL,
  MONITORING_USER,
  MONITORING_PASSWORD,
  SELECT_DB,
  SELECT_SIZE,
} = process.env;
let token: string;

test.describe.configure({ retries: 0 });

[
  { db: 'psmdb', size: 3 },
  { db: 'pxc', size: 3 },
  { db: 'postgresql', size: 3 },
].forEach(({ db, size }) => {
  test.describe(
    'Demand backup workflow',
    {
      // Create cluster, add data, create backup, destroy data and do restore
      tag: '@release',
    },
    () => {
      test.skip(
        () =>
          (SELECT_DB !== db && !!SELECT_DB) ||
          (SELECT_SIZE !== size.toString() && !!SELECT_SIZE)
      );
      test.describe.configure({ timeout: 720000 });

      const clusterName = `${db}-${size}-dembkp`;

      let storageClasses = [];
      let namespace = EVEREST_CI_NAMESPACES.EVEREST_UI;
      let monitoringName = `${db}-${size}-pmm`;
      let baseBackupName = `dembkp-${db}-${size}`;

      test.beforeAll(async ({ request }) => {
        token = await getTokenFromLocalStorage();

        const { storageClassNames = [] } = await getClusterDetailedInfo(
          token,
          request
        );
        storageClasses = storageClassNames;
      });

      test.afterAll(async ({ request }) => {
        // we try to delete all monitoring instances because cluster creation expects that none exist
        // (monitoring instance is added in the form where the warning that none exist is visible)
        let monitoringInstances = await listMonitoringInstances(
          request,
          namespace,
          token
        );
        for (const instance of monitoringInstances) {
          await deleteMonitoringInstance(
            request,
            namespace,
            instance.name,
            token
          );
        }
      });

      test(`Cluster creation with ${db} and size ${size}`, async ({
        page,
        request,
      }) => {
        expect(storageClasses.length).toBeGreaterThan(0);

        await page.goto('/databases/new');
        await page.getByTestId('toggle-button-group-input-db-type').waitFor();
        await page.getByTestId('select-input-db-version').waitFor();

        // basic info
        await populateBasicInformation(
          page,
          db,
          storageClasses[0],
          clusterName
        );
        await moveForward(page);

        // resources
        await page
          .getByRole('button')
          .getByText(size + ' node')
          .click();
        await expect(page.getByText('Nº nodes: ' + size)).toBeVisible();
        await populateResources(page, 0.6, 1, 1, size);
        await moveForward(page);

        // backups
        await moveForward(page);

        // advanced
        await populateAdvancedConfig(page, db, '', true, '');
        await moveForward(page);

        // monitoring modal form
        await populateMonitoringModalForm(
          page,
          monitoringName,
          namespace,
          MONITORING_URL,
          MONITORING_USER,
          MONITORING_PASSWORD
        );
        await page.getByTestId('switch-input-monitoring').click();
        await expect(
          page.getByTestId('text-input-monitoring-instance')
        ).toHaveValue(monitoringName);
        await submitWizard(page);

        await expect(
          page.getByText('Awesome! Your database is being created!')
        ).toBeVisible();

        // go to db list and check status
        await page.goto('/databases');
        await waitForStatus(page, clusterName, 'Initializing', 15000);
        await waitForStatus(page, clusterName, 'Up', 600000);

        const response = await request.get(
          `/v1/namespaces/${namespace}/database-clusters`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        await checkError(response);

        // TODO: replace with correct payload typings from GET DB Clusters
        const { items: clusters } = await response.json();

        const addedCluster = clusters.find(
          (cluster) => cluster.metadata.name === clusterName
        );

        expect(addedCluster).not.toBeUndefined();
        expect(addedCluster?.spec.engine.type).toBe(db);
        expect(addedCluster?.spec.engine.replicas).toBe(size);
        expect(['600m', '0.6']).toContain(
          addedCluster?.spec.engine.resources?.cpu.toString()
        );
        expect(addedCluster?.spec.engine.resources?.memory.toString()).toBe(
          '1G'
        );
        expect(addedCluster?.spec.engine.storage.size.toString()).toBe('1Gi');
        expect(addedCluster?.spec.proxy.expose.type).toBe('internal');
        expect(addedCluster?.spec.proxy.replicas).toBe(size);
      });

      test(`Add data with ${db} and size ${size}`, async ({ page }) => {
        await prepareTestDB(clusterName, namespace);
      });

      test(`Create demand backup with ${db} and size ${size}`, async ({
        page,
      }) => {
        await gotoDbClusterBackups(page, clusterName);
        await clickOnDemandBackup(page);
        await page.getByTestId('text-input-name').fill(baseBackupName + '-1');
        await expect(page.getByTestId('text-input-name')).not.toBeEmpty();
        await expect(
          page.getByTestId('text-input-storage-location')
        ).not.toBeEmpty();
        await page.getByTestId('form-dialog-create').click();

        await waitForStatus(page, baseBackupName + '-1', 'Succeeded', 240000);
      });

      test(`Delete data with ${db} and size ${size}`, async ({ page }) => {
        await dropTestDB(clusterName, namespace);
      });

      test(`Restore cluster with ${db} and size ${size}`, async ({ page }) => {
        await gotoDbClusterBackups(page, clusterName);
        await findRowAndClickActions(
          page,
          baseBackupName + '-1',
          'Restore to this DB'
        );
        await expect(
          page.getByTestId('select-input-backup-name')
        ).not.toBeEmpty();
        await page.getByTestId('form-dialog-restore').click();

        await page.goto('/databases');
        await waitForStatus(page, clusterName, 'Restoring', 30000);
        await waitForStatus(page, clusterName, 'Up', 600000);

        await gotoDbClusterRestores(page, clusterName);
        // we select based on backup source since restores cannot be named and we don't know
        // in advance what will be the name
        await waitForStatus(page, baseBackupName + '-1', 'Succeeded', 120000);
      });

      test(`Check data after restore with ${db} and size ${size}`, async ({
        page,
      }) => {
        const result = await queryTestDB(clusterName, namespace);
        switch (db) {
          case 'pxc':
            expect(result.trim()).toBe('1\n2\n3');
            break;
          case 'psmdb':
            expect(result.trim()).toBe('[ { a: 1 }, { a: 2 }, { a: 3 } ]');
            break;
          case 'postgresql':
            expect(result.trim()).toBe('1\n 2\n 3');
            break;
        }
      });

      test(`Delete restore with ${db} and size ${size}`, async ({ page }) => {
        await gotoDbClusterRestores(page, clusterName);
        await findRowAndClickActions(page, baseBackupName + '-1', 'Delete');
        await expect(page.getByLabel('Delete restore')).toBeVisible();
        await page.getByTestId('confirm-dialog-delete').click();
        await waitForDelete(page, baseBackupName + '-1', 15000);
      });

      test(`Delete backup with ${db} and size ${size}`, async ({ page }) => {
        await gotoDbClusterBackups(page, clusterName);
        await findRowAndClickActions(page, baseBackupName + '-1', 'Delete');
        await expect(page.getByLabel('Delete backup')).toBeVisible();
        await page.getByTestId('form-dialog-delete').click();
        await waitForDelete(page, baseBackupName + '-1', 30000);
      });

      test(`Delete cluster with ${db} and size ${size}`, async ({ page }) => {
        await deleteDbCluster(page, clusterName);
        await waitForStatus(page, clusterName, 'Deleting', 15000);
        await waitForDelete(page, clusterName, 120000);
      });
    }
  );
});
