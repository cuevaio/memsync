import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "MEMSYNC_",
  client: {
    MEMSYNC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    MEMSYNC_APP_URL: process.env.MEMSYNC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
