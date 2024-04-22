import type { Meta, StoryObj } from '@storybook/react';
import { FormProvider, useForm } from 'react-hook-form';

import Checkbox from "./checkbox";
import { CheckboxProps } from "./checkbox.types";

type ExpandedCheckboxProps = CheckboxProps & {
  customSize: number,
  message: string,
  disabled: boolean,
  required: true,
  checked: boolean,
}

const meta = {
  title: 'Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
  },
  render: function Render({
    checked,
    required,
    disabled, 
    customSize,
    ...args
  }) {
    const methods = useForm();

    return (
      <FormProvider {...methods}>
        <Checkbox 
          {...args}
          name='checkbox small'
          label='checkbox small'
          checkboxProps={{
            size: 'small',
            required,
            checked,
          }}
          controllerProps={{
            disabled,
          }}
        />

        <Checkbox 
          {...args}
          name='checkbox medium'
          label='checkbox medium'
          checkboxProps={{
            size: 'small',
            required,
            checked,
          }}
          controllerProps={{
            disabled,
          }}
        />

        <Checkbox 
          {...args}
          name='checkbox customSize(default value = "large")'
          label='checkbox customSize(default value = "large")'
          checkboxProps={{
            sx:{ '& .MuiSvgIcon-root': { fontSize: customSize }},
            required,
            checked,
          }}
          controllerProps={{
            disabled,
          }}
        />
        
      </FormProvider>
    )
  },
} satisfies Meta<ExpandedCheckboxProps>;
export default meta;

type Story = StoryObj<ExpandedCheckboxProps>;

export const Basic: Story = {
  args: {
    disabled: true,
    required: true,
    checked: false,
    customSize: 28,
  },
};