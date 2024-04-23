import { FormProvider, useForm } from "react-hook-form";
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Meta, StoryObj } from "@storybook/react";

import DateTimePickerInput from "./date-time-picker";

type ExpandedDateTimePickerInputProps =  React.ComponentProps<typeof DateTimePickerInput> & {
    disabled: boolean,
    readOnly: boolean,
    label: string,
    minDate: Date,
    maxDate: Date,
}

const meta = {
    title: 'DateTimePickerInput',
    component: DateTimePickerInput,
    parameters: {
        layout: 'centered',
      },
    render: function Render({
        disabled,
        readOnly,
        minDate,
        maxDate,
        ...args
    }) {
        const methods = useForm();

        return (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <FormProvider {...methods}>
                    <DateTimePickerInput
                        {...args}
                        minDateTime={minDate}
                        maxDateTime={maxDate}
                        name='DateTimePickerInput'
                        disabled={disabled}
                        readOnly={readOnly}
                    />
                </FormProvider>
            </LocalizationProvider>
        );
    },
} satisfies Meta<ExpandedDateTimePickerInputProps>
export default meta;

type Story = StoryObj<Meta>

export const Basic: Story = {
    args: {
        disabled: false,
        readOnly: false,
        label: 'input a date and time',
        minDate: new Date(),
        maxDate: new Date().setDate(new Date().getDate() + 5),
    }
};