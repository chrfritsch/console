import type { AlertWebhookChannelResolvers } from './../../../__generated__/types';

export const AlertWebhookChannel: AlertWebhookChannelResolvers = {
  __isTypeOf: channel => {
    return channel.type === 'WEBHOOK';
  },
  endpoint: async channel => {
    return channel.webhookEndpoint!;
  },
};
