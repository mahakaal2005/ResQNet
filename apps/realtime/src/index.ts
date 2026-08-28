import { createGateway } from "./gateway/server";

const PORT = Number(process.env.PORT ?? 4000);

const { httpServer } = createGateway({ port: PORT });

httpServer.listen(PORT, () => {
  console.log(`[realtime] gateway listening on :${PORT}`);
  console.log(`[realtime] health check:      http://localhost:${PORT}/realtime/health`);
  console.log(`[realtime] socket namespace:  ws://localhost:${PORT}/realtime`);
});
