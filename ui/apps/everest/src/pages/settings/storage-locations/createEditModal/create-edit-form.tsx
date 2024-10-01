import { Divider, MenuItem } from '@mui/material';
import { AutoCompleteInput, SelectInput, TextInput } from '@percona/ui-lib';
import ForcePathCheckbox from 'components/force-path-checkbox';
import { HiddenInput } from 'components/hidden-input';
import TlsCheckbox from 'components/tls-checkbox';
import { useNamespaces } from 'hooks/api/namespaces/useNamespaces';
import { StorageType } from 'shared-types/backupStorages.types';
import { Messages } from '../storage-locations.messages';
import { StorageLocationsFields } from '../storage-locations.types';

interface CreateEditFormProps {
  isEditMode: boolean;
}
export const CreateEditStorageForm = ({ isEditMode }: CreateEditFormProps) => {
  const { data: namespaces = [], isFetching: isNamespacesFetching } =
    useNamespaces();

  return (
    <>
      <TextInput
        textFieldProps={{
          placeholder: Messages.createEditModal.placeholders.name,
          disabled: isEditMode,
        }}
        name={StorageLocationsFields.name}
        label={Messages.name}
        isRequired
        labelProps={{ sx: { mt: 0 } }}
      />
      <TextInput
        textFieldProps={{
          placeholder: Messages.createEditModal.placeholders.description,
        }}
        name={StorageLocationsFields.description}
        label={Messages.description}
      />
      <AutoCompleteInput
        name={StorageLocationsFields.namespace}
        label={Messages.namespace}
        disabled={isEditMode}
        loading={isNamespacesFetching}
        options={namespaces}
        isRequired
        textFieldProps={{
          placeholder: Messages.createEditModal.placeholders.namespace,
        }}
      />
      <Divider sx={{ mt: 4, mb: 2 }} />
      <SelectInput
        name={StorageLocationsFields.type}
        label={Messages.type}
        selectFieldProps={{ disabled: isEditMode }}
        isRequired
      >
        <MenuItem value={StorageType.S3}>{Messages.s3}</MenuItem>
        {/* <MenuItem value={StorageType.GCS}>{Messages.gcs}</MenuItem> */}
        {/* <MenuItem value={StorageType.AZURE}>{Messages.azure}</MenuItem> */}
      </SelectInput>
      <TextInput
        name={StorageLocationsFields.bucketName}
        label={Messages.bucketName}
        isRequired
        textFieldProps={{
          placeholder: Messages.createEditModal.placeholders.type,
          disabled: isEditMode,
        }}
      />
      <TextInput
        name={StorageLocationsFields.region}
        label={Messages.region}
        isRequired
        textFieldProps={{
          placeholder: Messages.createEditModal.placeholders.region,
          disabled: isEditMode,
        }}
      />
      <TextInput
        name={StorageLocationsFields.url}
        label={Messages.url}
        isRequired
        textFieldProps={{
          placeholder: Messages.createEditModal.placeholders.url,
        }}
      />
      <HiddenInput
        placeholder={Messages.createEditModal.placeholders.accessKey}
        name={StorageLocationsFields.accessKey}
        label={Messages.accessKey}
        isRequired
      />
      <HiddenInput
        name={StorageLocationsFields.secretKey}
        label={Messages.secretKey}
        placeholder={Messages.createEditModal.placeholders.secretKey}
        isRequired
      />
      <TlsCheckbox formControlLabelProps={{ sx: { mt: 2 } }} />
      <ForcePathCheckbox formControlLabelProps={{ sx: { mt: 2 } }} />
    </>
  );
};
