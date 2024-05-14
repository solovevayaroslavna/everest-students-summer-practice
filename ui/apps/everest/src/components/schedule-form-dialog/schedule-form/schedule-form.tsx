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

import { AutoCompleteInput, LabeledContent, TextInput } from '@percona/ui-lib';
import { BackupStorage } from 'shared-types/backupStorages.types.ts';
import { Schedule } from 'shared-types/dbCluster.types.ts';
import LogicalPhysicalRadioGroup from 'components/logical-physical-radio-group';
import { AutoCompleteAutoFill } from '../../auto-complete-auto-fill/auto-complete-auto-fill.tsx';
import { TimeSelection } from '../../time-selection/time-selection';
import { Messages } from './schedule-form.messages.ts';
import { ScheduleFormFields } from './schedule-form.types.ts';

type ScheduleFormProps = {
  allowScheduleSelection?: boolean;
  disableStorageSelection?: boolean;
  disableNameInput?: boolean;
  autoFillLocation?: boolean;
  schedules: Schedule[];
  storageLocationFetching: boolean;
  storageLocationOptions: BackupStorage[];
  showTypeRadio: boolean;
  hideRetentionCopies?: boolean;
};
export const ScheduleForm = ({
  allowScheduleSelection,
  disableStorageSelection = false,
  disableNameInput,
  autoFillLocation,
  schedules,
  storageLocationFetching,
  storageLocationOptions,
  showTypeRadio,
  hideRetentionCopies,
}: ScheduleFormProps) => {
  const schedulesNamesList =
    (schedules && schedules.map((item) => item?.name)) || [];
  return (
    <>
      {showTypeRadio && <LogicalPhysicalRadioGroup />}
      <LabeledContent label={Messages.backupDetails}>
        {allowScheduleSelection ? (
          <AutoCompleteInput
            name={ScheduleFormFields.scheduleName}
            textFieldProps={{
              label: Messages.scheduleName.label,
            }}
            options={schedulesNamesList}
            isRequired
          />
        ) : (
          <TextInput
            name={ScheduleFormFields.scheduleName}
            textFieldProps={{
              label: Messages.scheduleName.label,
              disabled: disableNameInput,
            }}
            isRequired
          />
        )}
      </LabeledContent>

      <AutoCompleteAutoFill
        name={ScheduleFormFields.storageLocation}
        textFieldProps={{
          label: Messages.storageLocation.label,
        }}
        loading={storageLocationFetching}
        options={storageLocationOptions}
        autoCompleteProps={{
          isOptionEqualToValue: (option, value) => option.name === value.name,
          getOptionLabel: (option) =>
            typeof option === 'string' ? option : option.name,
        }}
        isRequired
        enableFillFirst={autoFillLocation}
        disabled={disableStorageSelection}
      />
      {!hideRetentionCopies && (
        <TextInput
          name={ScheduleFormFields.retentionCopies}
          textFieldProps={{
            type: 'number',
            label: Messages.retentionCopies.label,
            helperText: Messages.retentionCopies.helperText,
          }}
          isRequired
        />
      )}
      <LabeledContent label={Messages.repeats}>
        <TimeSelection showInfoAlert />
      </LabeledContent>
    </>
  );
};
