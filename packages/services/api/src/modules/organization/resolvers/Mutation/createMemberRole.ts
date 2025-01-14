import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import { createOrUpdateMemberRoleInputSchema } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types';

export const createMemberRole: NonNullable<MutationResolvers['createMemberRole']> = async (
  _,
  { input },
  { injector },
) => {
  const inputValidation = createOrUpdateMemberRoleInputSchema.safeParse({
    name: input.name,
    description: input.description,
  });

  if (!inputValidation.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          name: inputValidation.error.formErrors.fieldErrors.name?.[0],
          description: inputValidation.error.formErrors.fieldErrors.description?.[0],
        },
      },
    };
  }

  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  return injector.get(OrganizationManager).createMemberRole({
    organizationId,
    name: inputValidation.data.name,
    description: inputValidation.data.description,
    organizationAccessScopes: input.organizationAccessScopes,
    projectAccessScopes: input.projectAccessScopes,
    targetAccessScopes: input.targetAccessScopes,
  });
};
