import { useWebSocketStore, type WebSocketState } from "~/stores/webSocket";

interface WebSocketMessage<T = any> {
	type: string;
	to: string;
	data: T;
}

class WebSocketService {
	private static instance: WebSocketService;
	private ws: WebSocket | null = null;
	private url: string | null = null;
	private reconnectAttempts = 0;
	private maxRetryInterval = 300000;
	private maxReconnectAttempts = 5;
	private heartbeatInterval: number | null = null;
	private reconnectTimeout: number | null = null;
	private heartbeatTimeout: number | null = null;
	private readonly HEARTBEAT_INTERVAL = 15000; // 心跳间隔
	private readonly HEARTBEAT_TIMEOUT = 5000; // 心跳超时
	private messageHandlers: Map<string, (data: any) => void> = new Map();

	private constructor() {}

	// 单例
	static getInstance(): WebSocketService {
		if (!WebSocketService.instance) {
			WebSocketService.instance = new WebSocketService();
		}
		return WebSocketService.instance;
	}

	// 心跳
	private startHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}
		this.heartbeatInterval = window.setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send("ping");
				// Clear previous timeout
				if (this.heartbeatTimeout) {
					clearTimeout(this.heartbeatTimeout);
				}
				// Set timeout for pong response
				this.heartbeatTimeout = window.setTimeout(() => {
					console.log("Heartbeat timeout - no pong received");
					if (this.ws) {
						this.ws.close();
					}
				}, this.HEARTBEAT_TIMEOUT);
			}
		}, this.HEARTBEAT_INTERVAL);
	}

	private stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
		if (this.heartbeatTimeout) {
			clearTimeout(this.heartbeatTimeout);
			this.heartbeatTimeout = null;
		}
	}

	private scheduleReconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.updateState("disconnected");
			return;
		}
		// Exponential backoff 指数退避
		const backoffTime = Math.min(
			1000 * 2 ** this.reconnectAttempts,
			this.maxRetryInterval,
		);
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}
		this.reconnectTimeout = window.setTimeout(() => {
			this.reconnectAttempts++;
			this.reconnect();
		}, backoffTime);
	}

	private updateState(status: WebSocketState) {
		useWebSocketStore.getState().setWebSocketState(status);
	}

	private getConnection(): WebSocket | null {
		return this.ws;
	}

	// 连接
	connect(url: string) {
		this.url = url;
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			// 已连接
			this.updateState("connected");
			return this.ws;
		}
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.ws = new WebSocket(this.url);
		// 连接中
		this.updateState("connecting");

		this.ws.onopen = () => {
			this.reconnectAttempts = 0; // 重置重连次数
			this.updateState("connected"); // 连接成功
			this.startHeartbeat(); // 开始心跳
		};

		this.ws.onclose = () => {
			this.updateState("disconnected"); // 连接断开
			this.stopHeartbeat(); // 停止心跳
			this.scheduleReconnect(); // 调度重连
		};
		this.ws.onerror = (error) => {
			this.updateState("disconnected");
		};

		this.ws.onmessage = (msg) => {
			// 心跳
			if (msg.data === "pong") {
				if (this.heartbeatTimeout) {
					clearTimeout(this.heartbeatTimeout);
					this.heartbeatTimeout = null;
				}
				return;
			}
			if (msg.data === "ping") {
				this.ws?.send("pong");
				return;
			}
			// 消息
			try {
				const data = JSON.parse(msg.data);
				const handler = this.messageHandlers.get(data.type);
				if (handler) {
					handler(data);
				} else {
					console.log("unknown message type: ", data.type);
				}
			} catch (error) {
				console.error("Failed to parse message:", error);
			}
		};
		return this.ws;
	}

	reconnect() {
		if (this.url) {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				console.log("ws already connected, skip reconnect");
				return;
			}
			if (this.ws) {
				this.ws.close();
				this.ws = null;
			}
			this.connect(this.url);
		}
	}

	disconnect() {
		this.stopHeartbeat();
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.url = null; // Clear the url
		this.reconnectAttempts = 0;
	}

	sendMessage<T>(msg: WebSocketMessage<T>) {
		const ws = this.getConnection();
		if (!ws) return;
		ws.send(JSON.stringify(msg));
	}

	// 注册消息处理器
	registerHandler(type: string, handler: (data: any) => void) {
		this.messageHandlers.set(type, handler);
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	isConnecting(): boolean {
		return this.ws?.readyState === WebSocket.CONNECTING;
	}
}

export const webSocketService = WebSocketService.getInstance();
