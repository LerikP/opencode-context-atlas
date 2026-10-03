import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";
import { reportSchema } from "./report.ts";

export const atlasRpc = Rpc.define({
  id: "context-atlas",
  methods: {
    report: {
      input: z.object({ sessionID: z.string().min(1) }),
      output: reportSchema,
    },
  },
  events: {},
});
