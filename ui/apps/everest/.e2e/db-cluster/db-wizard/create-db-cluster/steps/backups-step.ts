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
import { Page, expect } from '@playwright/test';
import { addFirstScheduleInDBWizard } from '../../db-wizard-utils';

export const backupsStepCheck = async (page: Page) => {
  await expect(
    page.getByText(
      'Create a task that takes regular backups of this database, according to the schedule that you specify.'
    )
  ).toBeVisible();

  await addFirstScheduleInDBWizard(page);
};
