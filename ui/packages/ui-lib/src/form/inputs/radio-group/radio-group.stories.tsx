import RadioGroup from './radio-group';
import { RadioGroupProps } from './radio-group.types';'./radio-group.types'
import type { Meta, StoryObj } from '@storybook/react';
import { FormProvider, useForm } from 'react-hook-form';

type ExpandedRadioGroupProps = RadioGroupProps & {
  customSize: number
}

const meta = {
  title: 'RadioGroup',
  component: RadioGroup,
  parameters: {
    layout: 'centered',
  },
  render: function Render({
    customSize,
    options,
    ...args
  }) {
    const methods = useForm();

    return (
        <FormProvider {...methods}>
          <RadioGroup 
            radioGroupFieldProps={{
              sx: {
                '& .MuiSvgIcon-root': {
                  fontSize: 20,
                },
              }
            }}
            label='Radio-group small'
            options={options} 
            {...args}
          />

          <RadioGroup 
            radioGroupFieldProps={{
              sx: {
                '& .MuiSvgIcon-root': {
                  fontSize: 24,
                },
              }
            }}
            label='Radio-group medium'
            options={options} 
            {...args}
          />
          
          <RadioGroup
            radioGroupFieldProps={{
              sx: {
                '& .MuiSvgIcon-root': {
                  fontSize: customSize,
                },
              }
            }}
            label='Radio-group customSize'
            options={options} 
            {...args}
          />
        </FormProvider>
    );
  },
} satisfies Meta<ExpandedRadioGroupProps>;
export default meta;

type Story = StoryObj<ExpandedRadioGroupProps>;

export const Basic: Story = {
  args: {
    name: 'example1',
    options: [{label: 'First', value: 'First'}, {label: 'Second', value: 'Second'}, {label: 'Third', value: 'Third', disabled: true}],
    customSize: 40,
  },
};