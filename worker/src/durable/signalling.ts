import { DurableObject } from "cloudflare:workers";
import type { WebSocketRequestResponsePair } from "@cloudflare/workers-types";

export class SignallingServer extends DurableObject {
	env: Env;
	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.env = env;
		this.ctx.setWebSocketAutoResponse(
			// @ts-ignore
			new WebSocketRequestResponsePair("ping", "pong"),
		);
	}

	async fetch(request: Request) {
		const id = new URL(request.url).searchParams.get("id");
		if (typeof id !== "string") {
			return new Response("Missing id", { status: 400 });
		}
		return this.connectWebSocket(id);
	}

	async connectWebSocket(id: string) {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		server.serializeAttachment({
			id,
		});
		this.ctx.acceptWebSocket(server, [id]);
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		const { id } = ws.deserializeAttachment();
		const msg = JSON.parse(message.toString());
		msg.from = id;
		for (const client of this.ctx.getWebSockets(msg.to)) {
			client.send(JSON.stringify(msg));
		}
	}

	async webSocketClose(ws: WebSocket) {
		ws.close();
	}
}
