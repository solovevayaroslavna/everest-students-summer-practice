import { z } from 'zod';
import { MonitoringInstance } from 'shared-types/monitoring.types';
import { rfc_123_schema } from 'utils/common-validation';
import { Messages } from '../monitoring-endpoints.messages';

export enum EndpointFormFields {
  name = 'name',
  namespace = 'namespace',
  url = 'url',
  user = 'user',
  password = 'password',
  verifyTLS = 'verifyTLS',
}

export interface CreateEditEndpointModalProps {
  open: boolean;
  handleClose: () => void;
  handleSubmit: (isEditMode: boolean, data: EndpointFormType) => void;
  selectedEndpoint?: MonitoringInstance;
  isLoading?: boolean;
}

export const getEndpointSchema = (isEditMode: boolean) =>
  z
    .object({
      [EndpointFormFields.name]: rfc_123_schema('endpoint name'),
      [EndpointFormFields.namespace]: z.string().nonempty(),
      [EndpointFormFields.verifyTLS]: z.boolean(),
      [EndpointFormFields.url]: z.string().min(1).url(),
      ...(isEditMode
        ? {
            [EndpointFormFields.user]: z.string(),
            [EndpointFormFields.password]: z.string(),
          }
        : {
            [EndpointFormFields.user]: z.string().min(1),
            [EndpointFormFields.password]: z.string().min(1),
          }),
    })
    .superRefine((arg, ctx) => {
      const hasUser = !!arg.user;
      const hasPassword = !!arg.password;

      if (hasUser !== hasPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [
            arg.user ? EndpointFormFields.password : EndpointFormFields.user,
          ],
          message: Messages.helperText.credentials,
        });
      }
    });

export const endpointDefaultValues = {
  [EndpointFormFields.name]: '',
  [EndpointFormFields.namespace]: '',
  [EndpointFormFields.url]: '',
  [EndpointFormFields.user]: '',
  [EndpointFormFields.password]: '',
  [EndpointFormFields.verifyTLS]: true,
};

export type EndpointFormType = z.infer<ReturnType<typeof getEndpointSchema>>;
