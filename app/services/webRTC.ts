import { useWebRTCStore } from "~/stores/webRTC";
import { webSocketService } from "~/services/webSocket";

type PeerConnectionConfig = {
	iceServers: RTCIceServer[];
};

class WebRTCService {
	private static instance: WebRTCService;
	private peerId: string = "";
	private peerConnection: RTCPeerConnection | null = null;
	private config: PeerConnectionConfig = {
		iceServers: [
			{ urls: "stun:stun.l.google.com:19302" },
			{ urls: "stun:stun1.l.google.com:19302" },
		],
	};
	private constructor() {
		webSocketService.registerHandler("ice_candidate", (data) => {
			this.peerConnection?.addIceCandidate(new RTCIceCandidate(data.data));
		});
		webSocketService.registerHandler("answer", (data) => {
			this.peerConnection?.setRemoteDescription(
				new RTCSessionDescription(data.data),
			);
		});
	}

	public static getInstance(): WebRTCService {
		if (!WebRTCService.instance) {
			WebRTCService.instance = new WebRTCService();
		}
		return WebRTCService.instance;
	}

	public async connect(to: string): Promise<RTCPeerConnection> {
		if (this.peerConnection && this.peerId === to) {
			return this.peerConnection;
		}
		this.peerId = to;
		const pc = new RTCPeerConnection(this.config);

		pc.onicecandidate = (event) => {
			if (event.candidate) {
				webSocketService.sendMessage({
					type: "ice_candidate",
					to: this.peerId,
					data: event.candidate,
				});
			}
		};
		pc.ontrack = (event) => {
			console.log("Track received:", event.track.kind);
			// 使用最新的流
			const [remoteStream] = event.streams;
			if (remoteStream) {
				console.log(
					"Setting remote stream with tracks:",
					remoteStream.getTracks(),
				);
				useWebRTCStore.getState().setRemoteStream(remoteStream);
			}
		};
		pc.onnegotiationneeded = async () => {
			if (pc.remoteDescription) return;
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			webSocketService.sendMessage({
				type: "offer",
				to: this.peerId,
				data: offer,
			});
		};
		pc.onconnectionstatechange = (event) => {
			if (pc.connectionState) {
				useWebRTCStore.getState().setConnectionState(pc.connectionState);
				console.log("Connection state:", pc.connectionState);
			}
		};
		pc.onicecandidateerror = (event) => {
			console.log("ICE candidate error:", event);
		};
		pc.oniceconnectionstatechange = () => {
			console.log("ICE connection state:", pc.iceConnectionState);
		};
		this.peerConnection = pc;
		return pc;
	}

	// 处理接收到的 offer
	public async handleOffer(
		peerId: string,
		offer: RTCSessionDescriptionInit,
	): Promise<void> {
		const pc = await this.connect(peerId);
		await pc.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		webSocketService.sendMessage({
			type: "answer",
			to: peerId,
			data: answer,
		});
	}

	public close(): void {
		useWebRTCStore.getState().setConnectionState("disconnected");
		useWebRTCStore.getState().setRemoteStream(undefined);
		if (this.peerConnection) {
			this.peerConnection.close();
			this.peerConnection = null;
		}
		this.peerId = "";
	}
}

// 导出单例实例
export const webRTCService = WebRTCService.getInstance();
