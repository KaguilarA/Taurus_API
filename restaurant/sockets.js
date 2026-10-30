import { Server } from "socket.io";
import mongoose from "mongoose";
import { Accounts, Bill } from "./models.js";
import { billActivity, hasStaffOrders } from "./order-activity.js";

export const ORDER_SOCKET_PATH = "/api/socket.io";

export function attachOrderSockets(
  server,
  { sessionMiddleware, origin, authCheckMs = 20000 },
) {
  const io = new Server(server, {
    path: ORDER_SOCKET_PATH,
    serveClient: false,
    transports: ["websocket"],
    cors: { origin, credentials: true },
    allowRequest: (req, done) =>
      done(null, !req.headers.origin || req.headers.origin === origin),
    maxHttpBufferSize: 4096,
  });
  io.engine.use(sessionMiddleware);
  let changes,
    starting,
    closing = false;

  // One Mongo subscription per API process, created only while sockets are in use.
  // startAtOperationTime covers changes committed while the cursor is starting.
  async function startChanges() {
    if (changes || closing) return;
    if (!starting)
      starting = (async () => {
        const hello = await mongoose.connection.db
          .admin()
          .command({ hello: 1 });
        if (closing) return;
        const stream = Bill.watch([], {
          startAtOperationTime: hello.operationTime,
        });
        changes = stream;
        stream.on("change", (change) => {
          const billId = String(change.documentKey._id);
          io.to(`bill:${billId}`).emit("orders:changed", { billId });
          io.to("staff:orders").emit("orders:changed", { billId });
        });
        stream.on("error", () => {
          // A closing cursor must not disconnect clients of a newer subscription.
          if (changes !== stream) return;
          changes = undefined;
          void stream.close().catch(() => {});
          io.disconnectSockets(true);
        });
      })().finally(() => {
        starting = undefined;
      });
    await starting;
  }
  async function stopUnusedChanges() {
    if (io.sockets.sockets.size || !changes) return;
    const stream = changes;
    changes = undefined;
    await stream.close().catch(() => {});
  }
  async function authorize(socket) {
    const auth = socket.handshake.auth;
    if (auth?.kind === "bill") {
      const { bill, hasOrders } = await billActivity(auth.token);
      if (!hasOrders)
        throw Object.assign(new Error("La cuenta no tiene pedidos activos."), {
          code: "NO_ACTIVE_ORDERS",
        });
      return { kind: "bill", billId: bill.id, token: bill.token };
    }
    if (auth?.kind !== "staff")
      throw Object.assign(new Error("Suscripción inválida."), {
        code: "INVALID_SCOPE",
      });
    const session = socket.request.session;
    const account = session?.userId
      ? await Accounts.getOne({ _id: session.userId })
      : null;
    if (
      !account ||
      (session.userVersion ?? 0) !== (account.sessionVersion ?? 0) ||
      !["admin", "waiter", "kitchen"].includes(account.role ?? "admin")
    )
      throw Object.assign(new Error("Iniciá sesión de nuevo."), {
        code: "UNAUTHORIZED",
      });
    const role = account.role ?? "admin";
    if (!(await hasStaffOrders(role)))
      throw Object.assign(new Error("No hay pedidos para tu rol."), {
        code: "NO_ACTIVE_ORDERS",
      });
    return { kind: "staff", role, accountId: String(account._id) };
  }
  io.use(async (socket, next) => {
    try {
      socket.data.scope = await authorize(socket);
      next();
    } catch (err) {
      const known = [
        "NO_ACTIVE_ORDERS",
        "UNAUTHORIZED",
        "INVALID_SCOPE",
      ].includes(err.code);
      const error = new Error(
        known || err.status === 404
          ? err.message
          : "No se pudo verificar la suscripción.",
      );
      error.data = { code: known ? err.code : "UNAUTHORIZED" };
      next(error);
    }
  });
  io.on("connection", async (socket) => {
    let timer,
      checking = false;
    socket.on("disconnect", () => {
      clearInterval(timer);
      void stopUnusedChanges();
    });
    try {
      await startChanges();
      if (!socket.connected || closing) {
        await stopUnusedChanges();
        return;
      }
      const scope = socket.data.scope;
      await socket.join(
        scope.kind === "bill" ? `bill:${scope.billId}` : "staff:orders",
      );
      // Refresh after joining, covering mutations between the HTTP snapshot and handshake.
      socket.emit(
        "orders:changed",
        scope.kind === "bill" ? { billId: scope.billId } : {},
      );
      timer = setInterval(async () => {
        if (checking) return;
        checking = true;
        try {
          if (scope.kind === "staff")
            await new Promise((resolve, reject) =>
              socket.request.session.reload((err) =>
                err ? reject(err) : resolve(),
              ),
            );
          const current = await authorize(socket);
          if (
            current.kind !== scope.kind ||
            (scope.kind === "staff" &&
              (current.accountId !== scope.accountId ||
                current.role !== scope.role))
          )
            throw new Error("Sesión modificada.");
        } catch {
          socket.emit("orders:idle");
          socket.disconnect(true);
        } finally {
          checking = false;
        }
      }, authCheckMs);
      timer.unref?.();
    } catch {
      socket.disconnect(true);
    }
  });
  return {
    io,
    async close() {
      closing = true;
      if (starting) await starting.catch(() => {});
      io.disconnectSockets(true);
      await stopUnusedChanges();
      await new Promise((resolve) => io.close(resolve));
    },
  };
}
