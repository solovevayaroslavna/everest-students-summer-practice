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

import { Box, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Messages } from '../database-form.messages';
import { DatabaseFormStepControllersProps } from './types';

const DatabaseFormStepControllers = ({
  disableBack,
  disableSubmit,
  disableCancel,
  disableNext,
  showSubmit,
  onPreviousClick,
  onNextClick,
  onCancel,
  onSubmit,
}: DatabaseFormStepControllersProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'row', pt: 4 }}>
    <Button
      type="button"
      startIcon={<ArrowBackIcon />}
      variant="text"
      disabled={disableBack}
      onClick={onPreviousClick}
      sx={{ mr: 1 }}
      data-testid="db-wizard-previous-button"
    >
      {Messages.previous}
    </Button>
    <Box sx={{ flex: '1 1 auto' }} />
    <Button
      variant="outlined"
      disabled={disableCancel}
      data-testid="db-wizard-cancel-button"
      sx={{ mr: 1 }}
      onClick={onCancel}
    >
      {Messages.cancel}
    </Button>
    {showSubmit ? (
      <Button
        onClick={onSubmit}
        variant="contained"
        disabled={disableSubmit}
        data-testid="db-wizard-submit-button"
      >
        {Messages.createDatabase}
      </Button>
    ) : (
      <Button
        onClick={onNextClick}
        variant="contained"
        disabled={disableNext}
        data-testid="db-wizard-continue-button"
      >
        {Messages.continue}
      </Button>
    )}
  </Box>
);

export default DatabaseFormStepControllers;
