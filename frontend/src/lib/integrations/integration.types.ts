export type ExportFormat = "CSV" | "JSON";

export type ExportPayload = {
  filename: string;
  mimeType: string;
  content: string;
};

export type WebhookEventType = "FINANCE_SUMMARY" | "AUDIT_TRACE" | "INVENTORY_SNAPSHOT";

export type WebhookEvent<TPayload extends object> = {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  payload: TPayload;
};

export type WebhookDispatchResult = {
  accepted: boolean;
  eventId: string;
};
