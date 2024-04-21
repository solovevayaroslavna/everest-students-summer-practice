import type { Meta, StoryObj } from '@storybook/react';
import { TextField } from '@mui/material';
import TextInput from './text';
import { TextInputProps } from './text.types';
import { useForm } from 'react-hook-form';
import { FormProvider } from 'react-hook-form';
import React from 'react';

type ExpandedTextInputProps = TextInputProps & {
  readOnly?: boolean,
  type?: string, 
  size?: "small" | "medium", 
  maxLenght?: number, 
  value?: string,
  placeholder?: string,
  error?: boolean,
  disabled?: boolean,
  multiline?: boolean,
  minRows?: number,
}

const meta = {
  title: 'TextField',
  component: TextInput,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      options: ['small', 'medium'],
      control: { type: 'radio' },
    }
  },
  render: function Render({
    readOnly,
    size,
    disabled,
    placeholder,
    // value,
    type, // не понимаю почему он не отрабатывает. даже пытался в самом компоненте type указать(type password)
    maxLenght, // не отрабатывает хотя такой prop существует в inputProps
    error, // не отрабатывает без костыля. Хотя дизайнерам должно хватить. Но не будет хелпер-текста
    ...args
  }) {
    const methods = useForm();
    if(error) {
      methods.setError('example1', {});
      methods.setError('example2', {});
    } else {
      methods.clearErrors('example1');
      methods.clearErrors('example2');
    }
    return (
      <FormProvider {...methods}>
        {/* <TextField name='example3' label='hello' error/>  // это я просто смотрел как отрабатывает данный компонент, уберу все лишнее перед PR в fork*/} 
        <TextInput
          {...args}
          textFieldProps={{
            error,
            // value, // временно закомментировал, тк не очень удобно проверять компонент в storyBook, тк значение инпyта можно менять только через value, если данный параметр есть
            type,
            placeholder,
            disabled,
            size,
            multiline: true,
            minRows: 3,
            inputProps: {
              readOnly, 
              maxLenght
            }
          }}
        />
        {/* <TextInput {...args} name='example2'/>  в дальнейшем просто скопирую первый TextInp;ut без multiline & minrows props*/}
      </FormProvider>
    );
  },
} satisfies Meta<ExpandedTextInputProps>;

export default meta;
type Story = StoryObj<Meta>;

export const Basic: Story = {
  args: {
    name: 'example1',
    label: 'Label',
    placeholder: 'placeholder',
    value: '',
    maxLenght: 5,
    size: 'small',
    disabled: false,
    type: 'password',
    error: false,
    readOnly: false,
    isRequired: false,
  },
}