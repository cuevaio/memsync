import { Webhooks } from "@polar-sh/nextjs";

import { env } from "@/env";
import { refreshPolarCustomerStateForUser } from "@/lib/billing";

function extractExternalCustomerIdFromPolarPayload(payload: Record<string, unknown>) {
  const data = (payload.data as Record<string, unknown> | undefined) ?? {};
  const customer = (data.customer as Record<string, unknown> | undefined) ?? {};

  const values = [
    data.external_customer_id,
    data.external_id,
    customer.external_id,
    (data.customer_state as Record<string, unknown> | undefined)?.external_id
  ];

  return values.find(value => typeof value === "string") as string | undefined;
}

export const POST = Webhooks({
  webhookSecret: env.POLAR_WEBHOOK_SECRET ?? "",
  onPayload: async payload => {
    const externalCustomerId = extractExternalCustomerIdFromPolarPayload(payload as Record<string, unknown>);
    if (externalCustomerId) {
      await refreshPolarCustomerStateForUser(externalCustomerId);
    }
  }
});
