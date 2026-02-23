import type { WebhookDispatchResult, WebhookEvent } from "./integration.types";

export const webhookService = {
  async dispatch<TPayload extends object>(event: WebhookEvent<TPayload>, endpointUrl: string): Promise<WebhookDispatchResult> {
    void endpointUrl;
    return {
      accepted: true,
      eventId: event.id,
    };
  },
};
