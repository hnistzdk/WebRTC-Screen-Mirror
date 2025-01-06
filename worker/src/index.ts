export { SignallingServer } from "@/durable/signalling";

function CorsHeaders(origin: string): Headers {
	return new Headers({
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "*",
		"Access-Control-Max-Age": "86400",
	});
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method;
		if (method === "OPTIONS") {
			const origin = request.headers.get("Origin") || "*";
			return new Response(null, {
				status: 204,
				headers: CorsHeaders(origin),
			});
		}
		switch (url.pathname) {
			case "/connect": {
				const id: DurableObjectId = env.SIGNALLING_SERVER.idFromName("default");
				const stub = env.SIGNALLING_SERVER.get(id);
				return stub.fetch(request);
			}
		}
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
