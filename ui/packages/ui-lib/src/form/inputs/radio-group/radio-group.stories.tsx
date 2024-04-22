import type { Meta, StoryObj } from '@storybook/react';
import { FormProvider, useForm } from 'react-hook-form';

import RadioGroup from './radio-group';
import { RadioGroupProps } from './radio-group.types';

type ExpandedRadioGroupProps = RadioGroupProps & {
  customSize: number,
  required: boolean,
}

const meta = {
  title: 'RadioGroup',
  component: RadioGroup,
  parameters: {
    layout: 'centered',
  },
  render: function Render({
    required,
    customSize,
    options,
    ...args
  }) {
    const methods = useForm();
    
    return (
        <FormProvider {...methods}>
          <RadioGroup 
            {...args}
            isRequired={required}
            radioGroupFieldProps={{
              sx: {
                '& .MuiSvgIcon-root': {
                  fontSize: 20,
                },
              }
            }}
            label='Radio-group small'
            options={options} 
          />

          <RadioGroup 
            {...args}
            isRequired={required}
            radioGroupFieldProps={{
              sx: {
                '& .MuiSvgIcon-root': {
                  fontSize: 24,
                },
              }
            }}
            label='Radio-group medium'
            options={options} 
          />
          
          <RadioGroup
            {...args}
            isRequired={required}
            radioGroupFieldProps={{
              sx: {
                '& .MuiSvgIcon-root': {
                  fontSize: customSize,
                },
              }
            }}
            label='Radio-group customSize(default value = "large")'
            options={options} 
          />
        </FormProvider>
    );
  },
} satisfies Meta<ExpandedRadioGroupProps>;
export default meta;

type Story = StoryObj<ExpandedRadioGroupProps>;

export const Basic: Story = {
  args: {
    name: 'RadioGroup',
    options: [{label: 'First', value: 'First', disabled: false}, {label: 'Second', value: 'Second', disabled: false}, {label: 'Third', value: 'Third', disabled: true}],
    customSize: 28,
    required: false,
  },
};