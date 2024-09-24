import { StatusIconProps } from '@percona/ui-lib';
import { StackProps } from '@mui/material';

export type BaseStatus =
  | 'error'
  | 'paused'
  | 'pending'
  | 'success'
  | 'deleting'
  | 'unknown';

export type StatusFieldProps<T extends string | number | symbol> = {
  status: T;
  children: React.ReactNode;
  statusMap: Record<T, BaseStatus>;
  dataTestId?: string;
  iconProps?: StatusIconProps;
  stackProps?: StackProps;
};
