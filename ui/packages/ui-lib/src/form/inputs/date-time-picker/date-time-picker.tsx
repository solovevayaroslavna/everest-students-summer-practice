import { Controller, useFormContext } from 'react-hook-form';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { kebabize } from '@percona/utils';
import { DateTimePickerInputProps } from './date-time-picker.types';
import { PickerValidDate } from '@mui/x-date-pickers';

const DateTimePickerInput = <T extends PickerValidDate>({
  name,
  control,
  controllerProps,
  ...dateTimePickerProps
}: DateTimePickerInputProps<T>) => {
  const { control: contextControl } = useFormContext();

  return (
    <Controller
      name={name}
      control={control ?? contextControl}
      render={({ field, fieldState: { error } }) => (
        <DateTimePicker
          {...field}
          inputRef={field.ref}
          data-testid={`date-time-picker-${kebabize(name)}`}
          slotProps={{
            textField: {
              error: !!error,
              helperText: error ? error.message : '',
            },
          }}
          {...dateTimePickerProps}
        />
      )}
      {...controllerProps}
    />
  );
};

export default DateTimePickerInput;
