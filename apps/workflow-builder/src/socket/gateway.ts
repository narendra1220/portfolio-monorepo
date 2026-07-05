import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Redis } from "ioredis";
import { verifyToken, type Principal } from "../auth.js";
import { parseOp } from "../ops/validate.js";
import { applyOp } from "../ops/apply.js";
import type { OpRepo } from "../repo/ops.js";
import type { WorkflowRepo } from "../repo/workflows.js";
import type { PresenceTracker } from "../presence/tracker.js";
import type { OpEnvelope, Presence } from "../types.js";

export interface GatewayDeps {
  jwtSecret: string;
  workflows: WorkflowRepo;
  ops: OpRepo;
  presence: PresenceTracker;
  pub: Redis;
  sub: Redis;
}

const SNAPSHOT_EVERY = 200;

export function attachGateway(http: HttpServer, deps: GatewayDeps): Server {
  const io = new Server(http, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
  });
  io.adapter(createAdapter(deps.pub, deps.sub));

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);
    if (!token) return next(new Error("auth: token required"));
    try {
      const p = verifyToken(deps.jwtSecret, token);
      (socket.data as { principal: Principal }).principal = p;
      next();
    } catch {
      next(new Error("auth: invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const principal = (socket.data as { principal: Principal }).principal;

    socket.on("workflow:join", async (workflowId: string, ack?: (res: unknown) => void) => {
      try {
        if (typeof workflowId !== "string" || workflowId.length === 0) {
          throw new Error("workflowId required");
        }
        const w = await deps.workflows.get(workflowId);
        if (!w) throw new Error("workflow not found");
        const room = `wf:${workflowId}`;
        await socket.join(room);
        (socket.data as { workflowId?: string }).workflowId = workflowId;
        const hydrated = await deps.workflows.hydrate(workflowId);
        const presence = await deps.presence.list(workflowId);
        ack?.({
          ok: true,
          workflow: {
            id: w._id,
            name: w.name,
            version: w.version,
            doc: hydrated?.doc,
            seq: hydrated?.seq ?? 0,
          },
          presence,
        });
        socket.to(room).emit("presence:join", { actor: principal.sub });
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    });

    socket.on(
      "op:submit",
      async (
        msg: { workflowId: string; op: unknown },
        ack?: (res: unknown) => void,
      ) => {
        try {
          const op = parseOp(msg.op, principal.sub);
          const w = await deps.workflows.get(msg.workflowId);
          if (!w) throw new Error("workflow not found");
          const env = await deps.ops.append(msg.workflowId, op);
          io.to(`wf:${msg.workflowId}`).emit("op:apply", env);
          ack?.({ ok: true, seq: env.seq });

          if (env.seq % SNAPSHOT_EVERY === 0) {
            const hydrated = await deps.workflows.hydrate(msg.workflowId);
            if (hydrated) {
              await deps.workflows.updateSnapshot(
                msg.workflowId,
                hydrated.doc,
                hydrated.seq,
              );
            }
          }
        } catch (e) {
          ack?.({ ok: false, error: (e as Error).message });
        }
      },
    );

    socket.on(
      "presence:update",
      async (msg: {
        workflowId: string;
        cursor?: { x: number; y: number };
        selection?: string[];
      }) => {
        if (typeof msg?.workflowId !== "string") return;
        await deps.presence.set(msg.workflowId, principal.sub, {
          cursor: msg.cursor,
          selection: msg.selection,
        });
        const update: Presence = {
          actor: principal.sub,
          cursor: msg.cursor,
          selection: msg.selection,
          ts: Date.now(),
        };
        socket.to(`wf:${msg.workflowId}`).emit("presence:update", update);
      },
    );

    socket.on(
      "op:catchup",
      async (
        msg: { workflowId: string; sinceSeq: number },
        ack?: (res: unknown) => void,
      ) => {
        try {
          const ops = await deps.ops.since(msg.workflowId, msg.sinceSeq ?? 0);
          ack?.({ ok: true, ops });
        } catch (e) {
          ack?.({ ok: false, error: (e as Error).message });
        }
      },
    );

    socket.on("disconnect", async () => {
      const data = socket.data as { workflowId?: string };
      if (data.workflowId) {
        await deps.presence.remove(data.workflowId, principal.sub);
        socket.to(`wf:${data.workflowId}`).emit("presence:leave", {
          actor: principal.sub,
        });
      }
    });
  });

  return io;
}

export type { OpEnvelope };
export function applyOpForTests<T extends Parameters<typeof applyOp>[0]>(
  doc: T,
  op: Parameters<typeof applyOp>[1],
): T {
  return applyOp(doc, op) as T;
}
