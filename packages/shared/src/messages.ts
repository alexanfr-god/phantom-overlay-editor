import { z } from "zod";
import { LayoutDocumentSchema } from "./schema";

export const WsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("layout:push"),
    payload: LayoutDocumentSchema,
  }),
  z.object({
    type: z.literal("layout:ack"),
    clientId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("debug:ping"),
  }),
  z.object({
    type: z.literal("debug:pong"),
    serverTime: z.number(),
    clientCount: z.number(),
  }),
  z.object({
    type: z.literal("overlay:toggle"),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal("overlay:opacity"),
    value: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("client:hello"),
    role: z.enum(["desktop", "extension", "agent"]),
    clientId: z.string(),
  }),
  z.object({
    type: z.literal("popup:position"),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  z.object({
    type: z.literal("popup:closed"),
  }),
  z.object({
    type: z.literal("overlay:insets"),
    top: z.number(),
    left: z.number(),
    right: z.number(),
    bottom: z.number(),
  }),
  z.object({
    type: z.literal("canvas:resize"),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
]);

export type WsMessage = z.infer<typeof WsMessageSchema>;
