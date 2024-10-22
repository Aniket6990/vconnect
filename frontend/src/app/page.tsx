"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io as socketIO, Socket } from "socket.io-client";
import Peer, { Instance } from "simple-peer";

export default function Home() {
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [myid, setId] = useState<string>("");
  const [remoteUser, setRemoteUser] = useState<string>("");
  const [call, setCall] = useState({
    isReceivingCall: false,
    from: "",
    signal: "",
    to: "",
  });
  const [searching, setSearching] = useState<string>("");
  const [callAccepted, setCallAccepted] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("disconnected");
  const [callStatus, setCallStatus] = useState<string>(""); // New state for call status
  const connectionRef = useRef<Instance>();
  const socketRef = useRef<Socket>();

  const connectSocket = useCallback(() => {
    socketRef.current = socketIO(
      process.env.NEXT_PUBLIC_BACKEND_URL as string,
      {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
      }
    );

    socketRef.current.on("connect", () => {
      console.log("Connected to server");
      setId(socketRef.current!.id as string);
      setConnectionStatus("connected");
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      setConnectionStatus("disconnected");
    });

    socketRef.current.on("reconnect", (attemptNumber) => {
      console.log("Reconnected to server after", attemptNumber, "attempts");
      setConnectionStatus("connected");
    });

    socketRef.current.on("reconnect_error", (error) => {
      console.log("Reconnection error:", error);
    });

    socketRef.current.on("id", (id: string) => {
      setId(id);
    });

    socketRef.current.on("calling", (data: any) => {
      const { from, signal, to } = data;
      setCall({ isReceivingCall: true, from, signal, to });
    });

    socketRef.current.on("searching", (msg: string) => {
      setSearching(msg);
    });

    socketRef.current.on("callEnded", () => {
      endCall();
    });

    // Implement heartbeat
    const heartbeat = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("heartbeat");
      }
    }, 5000);

    return () => {
      clearInterval(heartbeat);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const setupMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        const localVideo = document.querySelector(
          "#user-video"
        ) as HTMLVideoElement;
        if (localVideo) localVideo.srcObject = stream;
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };

    setupMediaStream();
    const cleanup = connectSocket();

    // Handle network changes
    window.addEventListener("online", connectSocket);
    window.addEventListener("offline", () =>
      setConnectionStatus("disconnected")
    );

    return () => {
      cleanup();
      window.removeEventListener("online", connectSocket);
      window.removeEventListener("offline", () =>
        setConnectionStatus("disconnected")
      );
    };
  }, [connectSocket]);

  const createPeer = (initiator: boolean) => {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: localStream,
      config: {
        iceServers: [
          { urls: process.env.NEXT_PUBLIC_STUN_URL as string },
          {
            urls: process.env.NEXT_PUBLIC_TURN_URL as string,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL as string,
            username: process.env.NEXT_PUBLIC_TURN_PASSWORD as string,
          },
        ],
      },
    });

    peer.on("error", (err) => {
      console.error("Peer connection error:", err);
      // Attempt to reconnect
      setTimeout(() => {
        if (connectionRef.current) {
          connectionRef.current.destroy();
          newCall();
        }
      }, 5000);
    });

    return peer;
  };

  const answerCall = useCallback(() => {
    setSearching("");
    setCallAccepted(true);
    setCallStatus("Connecting..."); // Set call status when answering

    const peer = createPeer(false);

    peer.on("signal", (myData) => {
      socketRef.current!.emit("callAccepted", {
        id: call.from,
        from: call.to,
        signal: myData,
      });
    });

    peer.on("stream", (stream) => {
      setCallStatus("Connected"); // Update call status when stream is received
      const remoteUserVideo = document.querySelector(
        "#peer-video"
      ) as HTMLVideoElement;
      if (remoteUserVideo) remoteUserVideo.srcObject = stream;
    });

    peer.signal(call.signal);
    connectionRef.current = peer;
  }, [call, localStream]);

  useEffect(() => {
    if (call.isReceivingCall) {
      answerCall();
    }
  }, [call.isReceivingCall, answerCall]);

  const newCall = () => {
    setSearching("");
    setCallStatus("Connecting..."); // Set call status when initiating a call
    const peer = createPeer(true);

    peer.on("signal", (data) => {
      socketRef.current!.emit("callUser", {
        from: myid,
        signal: data,
      });
    });

    socketRef.current!.on("accepted", (data: any) => {
      const { from, signal, id } = data;
      console.log(`${from} has accepted`);
      setCallAccepted(true);
      setCall({ isReceivingCall: true, from, to: id, signal });
      peer.signal(signal);
    });

    peer.on("stream", (stream) => {
      setCallAccepted(true);
      setCallStatus("Connected"); // Update call status when stream is received
      const remoteUserVideo = document.querySelector(
        "#peer-video"
      ) as HTMLVideoElement;
      if (remoteUserVideo) remoteUserVideo.srcObject = stream;
    });

    connectionRef.current = peer;
  };

  const endCall = () => {
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }
    setCallAccepted(false);
    setCall({ isReceivingCall: false, from: "", signal: "", to: "" });
    setCallStatus(""); // Reset call status
  };

  const leaveCall = () => {
    endCall();
    socketRef.current!.emit("cutCall", { id: call.to, from: call.from });
  };

  return (
    <main className="flex flex-col justify-start items-center h-screen w-full bg-gray-100 p-8">
      <div className="bg-white rounded-lg shadow-md p-4 mb-8 w-full max-w-4xl">
        <span className="text-lg font-semibold">Your ID: {myid}</span>
        <span className="ml-4 text-lg">Status: {connectionStatus}</span>
      </div>

      <div className="w-full max-w-4xl flex justify-between items-stretch gap-4 mb-8">
        <div className="w-1/2 bg-white rounded-lg shadow-md p-4">
          <h2 className="text-xl font-semibold mb-2">Your Video</h2>
          <div className="relative pt-[56.25%]">
            {" "}
            {/* 16:9 aspect ratio */}
            <video
              id="user-video"
              autoPlay
              muted
              playsInline
              className="absolute top-0 left-0 w-full h-full object-cover rounded"
            ></video>
          </div>
        </div>
        <div className="w-1/2 bg-white rounded-lg shadow-md p-4">
          <h2 className="text-xl font-semibold mb-2">Remote Video</h2>
          <div className="relative pt-[56.25%]">
            {" "}
            {/* 16:9 aspect ratio */}
            {callAccepted ? (
              <video
                id="peer-video"
                autoPlay
                playsInline
                className="absolute top-0 left-0 w-full h-full object-cover rounded"
              ></video>
            ) : (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-200 rounded">
                <span className="text-lg text-gray-600">
                  {callStatus || "Not connected to anyone"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-4xl">
        <div className="flex items-center gap-4">
          <input
            type="text"
            className="flex-grow border-2 border-blue-400 rounded-md p-2"
            value={remoteUser}
            onChange={(e) => setRemoteUser(e.target.value)}
            placeholder="Enter remote user ID"
          />
          <button
            className="bg-blue-500 text-white rounded-md px-4 py-2 hover:bg-blue-600 transition-colors"
            onClick={newCall}
            disabled={!myid || callAccepted || connectionStatus !== "connected"}
          >
            Call
          </button>
          <button
            className="bg-red-500 text-white rounded-md px-4 py-2 hover:bg-red-600 transition-colors"
            onClick={leaveCall}
            disabled={!callAccepted}
          >
            End Call
          </button>
        </div>
        {searching && (
          <span className="block mt-2 text-blue-600">{searching}</span>
        )}
        {callStatus && (
          <span className="block mt-2 text-green-600">{callStatus}</span>
        )}
      </div>
    </main>
  );
}
