import {
  createPodSchedulingPolicy,
  createPodSchedulingPolicyWithValues,
  createRuleForPodSchedulingPolicyWithValues,
  deletePodSchedulingPolicy,
} from '@e2e/utils/policies';
import { setRBACPermissionsK8S } from '@e2e/utils/rbac-cmd-line';
import { expect, test } from '@playwright/test';
import { getNamespacesFn } from '@e2e/utils/namespaces';
import { getTokenFromLocalStorage } from '@e2e/utils/localStorage';
import {
  moveForward,
  populateBasicInformation,
  submitWizard,
} from '@e2e/utils/db-wizard';
import { deleteDbCluster } from '@e2e/utils/db-clusters-list';
import { waitForDelete, waitForStatus } from '@e2e/utils/table';
import { STORAGE_STATE_FILE } from '@e2e/constants';

const POD_SCHEDULING_POLICY_NAME = 'pod-scheduling-policy-rbac-test';
test.describe('Pod scheduling policies RBAC', () => {
  let namespace = '';
  test.beforeAll(async ({ request, browser }) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE_FILE,
    });
    const page = await context.newPage();
    await setRBACPermissionsK8S([
      ['pod-scheduling-policies', '*', '*'],
      ['namespaces', 'read', '*'],
      ['database-engines', '*', '*/*'],
    ]);
    const namespaces = await getNamespacesFn(
      await getTokenFromLocalStorage(),
      request
    );
    namespace = namespaces[0];
    await createPodSchedulingPolicyWithValues(
      page,
      POD_SCHEDULING_POLICY_NAME,
      'pxc'
    );
    await createRuleForPodSchedulingPolicyWithValues(
      page,
      POD_SCHEDULING_POLICY_NAME,
      'engine',
      'nodeAffinity',
      'required',
      1,
      '',
      'size',
      'In',
      'medium,large'
    );
  });

  test.afterAll(async ({ request }) => {
    await setRBACPermissionsK8S([['pod-scheduling-policies', '*', '*']]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await deletePodSchedulingPolicy(request, POD_SCHEDULING_POLICY_NAME);
  });

  test('Show Pod scheduling policies when allowed', async ({ page }) => {
    await setRBACPermissionsK8S([['pod-scheduling-policies', 'read', `*`]]);
    await page.goto('/settings/pod-scheduling-policies');
    await expect(page.getByText(POD_SCHEDULING_POLICY_NAME)).toBeVisible();
    await expect(page.getByText('everest-default-mongodb')).toBeVisible();
    await expect(page.getByText('everest-default-mysql')).toBeVisible();
    await expect(page.getByText('everest-default-postgresql')).toBeVisible();
  });

  test('Hide Pod scheduling policies when not allowed', async ({ page }) => {
    await setRBACPermissionsK8S([
      ['pod-scheduling-policies', 'read', 'some-other-policy'],
    ]);
    await page.goto('/settings/pod-scheduling-policies');
    await expect(page.getByText(POD_SCHEDULING_POLICY_NAME)).not.toBeVisible();
    await expect(page.getByText('everest-default-mongodb')).not.toBeVisible();
    await expect(page.getByText('everest-default-mysql')).not.toBeVisible();
    await expect(
      page.getByText('everest-default-postgresql')
    ).not.toBeVisible();
  });

  test('Ability to delete policy when allowed', async ({ page }) => {
    await setRBACPermissionsK8S([
      ['pod-scheduling-policies', 'read', `${POD_SCHEDULING_POLICY_NAME}`],
      ['pod-scheduling-policies', 'delete', `${POD_SCHEDULING_POLICY_NAME}`],
    ]);
    await page.goto('/settings/pod-scheduling-policies');
    await expect(page.getByText(POD_SCHEDULING_POLICY_NAME)).toBeVisible();
    await page
      .locator('.MuiTableRow-root')
      .filter({ hasText: POD_SCHEDULING_POLICY_NAME })
      .getByTestId('MoreHorizIcon')
      .click();
    await expect(page.getByText('Delete')).toBeVisible();
  });

  test('Hide policy delete icon when not allowed', async ({ page }) => {
    await setRBACPermissionsK8S([
      ['pod-scheduling-policies', 'read', `${POD_SCHEDULING_POLICY_NAME}`],
      ['pod-scheduling-policies', 'delete', `some-other-policy`],
    ]);
    await page.goto('/settings/pod-scheduling-policies');
    await expect(page.getByText(POD_SCHEDULING_POLICY_NAME)).toBeVisible();
    await page
      .locator('.MuiTableRow-root')
      .filter({ hasText: POD_SCHEDULING_POLICY_NAME })
      .getByTestId('MoreHorizIcon')
      .click();
    await expect(page.getByText('Delete')).not.toBeVisible();
  });

  test('Ability to update policy rules when allowed', async ({ page }) => {
    await setRBACPermissionsK8S([
      ['pod-scheduling-policies', 'read', `${POD_SCHEDULING_POLICY_NAME}`],
      ['pod-scheduling-policies', 'update', `${POD_SCHEDULING_POLICY_NAME}`],
    ]);
    await page.goto(
      `/settings/pod-scheduling-policies/${POD_SCHEDULING_POLICY_NAME}`
    );
    const addBtn = page.getByRole('button', { name: 'Add rule' });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await page.getByTestId('form-dialog-add').waitFor();
    await page.getByTestId('form-dialog-add').click();
    expect(
      await page.locator('[data-testid="edit-rule-button"]').count()
    ).toBeGreaterThan(0);
    expect(
      await page.locator('[data-testid="delete-rule-button"]').count()
    ).toBeGreaterThan(0);
  });

  test('Hide rule actions when not allowed', async ({ page }) => {
    await setRBACPermissionsK8S([
      ['pod-scheduling-policies', 'read', `${POD_SCHEDULING_POLICY_NAME}`],
      ['pod-scheduling-policies', 'update', `${POD_SCHEDULING_POLICY_NAME}`],
    ]);
    await page.goto(
      `/settings/pod-scheduling-policies/${POD_SCHEDULING_POLICY_NAME}`
    );
    await page.getByRole('button', { name: 'Add rule' }).waitFor();
    await page.getByRole('button', { name: 'Add rule' }).click();
    await page.getByTestId('form-dialog-add').waitFor();
    await page.getByTestId('form-dialog-add').click();

    await setRBACPermissionsK8S([
      ['pod-scheduling-policies', 'read', `${POD_SCHEDULING_POLICY_NAME}`],
      ['pod-scheduling-policies', 'update', `some-other-policy`],
    ]);
    await expect(
      page.getByRole('button', { name: 'Add rule' })
    ).not.toBeVisible();
    await expect(page.getByTestId('edit-rule-button')).not.toBeVisible();
    await expect(page.getByTestId('delete-rule-button')).not.toBeVisible();
  });

  test('Show only allowed policies on wizard', async ({ page }) => {
    const clusterName = 'pxc-rbac-test';
    await setRBACPermissionsK8S([
      ['pod-scheduling-policies', 'read', `${POD_SCHEDULING_POLICY_NAME}`],
      ['namespaces', 'read', '*'],
      ['database-engines', '*', '*/*'],
      ['database-clusters', '*', '*/*'],
    ]);
    await page.goto('/databases');
    await page.getByTestId('add-db-cluster-button').waitFor();
    await page.getByTestId('add-db-cluster-button').click();
    await page.getByTestId('add-db-cluster-button-pxc').click();
    await populateBasicInformation(
      page,
      namespace,
      clusterName,
      'pxc',
      '',
      false,
      null
    );
    await moveForward(page);
    await moveForward(page);
    await moveForward(page);

    await expect(
      page
        .getByTestId('switch-input-pod-scheduling-policy-enabled')
        .getByRole('checkbox')
    ).toBeEnabled();
    await page
      .getByTestId('switch-input-pod-scheduling-policy-enabled')
      .getByRole('checkbox')
      .check();
    await page.getByTestId('select-pod-scheduling-policy-button').click();
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.getByRole('option').first().click();
    await moveForward(page);
    await submitWizard(page);

    await deleteDbCluster(page, clusterName);
    await waitForStatus(page, clusterName, 'Deleting', 15000);
    await waitForDelete(page, clusterName, 240000);
  });
});
