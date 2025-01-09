"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io as socketIO, Socket } from "socket.io-client";
import Peer, { Instance } from "simple-peer";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";

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
  const [callStatus, setCallStatus] = useState<string>("Not Connected"); // New state for call status

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);

  const connectionRef = useRef<Instance>();
  const socketRef = useRef<Socket>();

  const audioTrackRef = useRef<MediaStreamTrack>();
  const videoTrackRef = useRef<MediaStreamTrack>();

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
      // Remove all listeners before ending the call
      socketRef.current?.removeAllListeners("accepted");
      endCall();
      // Reset call state
      setCall({ isReceivingCall: false, from: "", signal: "", to: "" });
    });

    socketRef.current.on("mediaStateUpdate", ({ audio, video }) => {
      console.log(`remote audio: ${audio} :: video: ${video}`);
      setRemoteVideoEnabled(video);
      setRemoteAudioEnabled(audio);
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
        console.log("socket disconnected");
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

        audioTrackRef.current = stream.getAudioTracks()[0];
        videoTrackRef.current = stream.getVideoTracks()[0];

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
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
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
          // newCall();
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
      connectionRef.current = undefined; // Clear the reference
    }
    setCallAccepted(false);
    setCallStatus("Not Connected");
    setRemoteVideoEnabled(true);
    setRemoteAudioEnabled(true);
  };

  const leaveCall = () => {
    endCall();
    socketRef.current!.emit("cutCall", { id: call.to, from: call.from });
    setCall({ isReceivingCall: false, from: "", signal: "", to: "" });
  };

  const toggleAudio = useCallback(() => {
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = !audioTrackRef.current.enabled;
      setIsAudioEnabled(audioTrackRef.current.enabled);
      // Notify peer about media state change
      if (callAccepted && socketRef.current) {
        socketRef.current.emit("mediaStateUpdate", {
          to: call.from,
          audio: audioTrackRef.current.enabled,
          video: videoTrackRef.current?.enabled || false,
        });
      }
    }
  }, [callAccepted, call]);

  // New function to toggle video
  const toggleVideo = useCallback(() => {
    if (videoTrackRef.current) {
      videoTrackRef.current.enabled = !videoTrackRef.current.enabled;
      setIsVideoEnabled(videoTrackRef.current.enabled);
      // Notify peer about media state change
      if (callAccepted && socketRef.current) {
        socketRef.current.emit("mediaStateUpdate", {
          to: call.from,
          audio: audioTrackRef.current?.enabled || false,
          video: videoTrackRef.current.enabled,
        });
      }
    }
  }, [callAccepted, call]);

  useEffect(() => {
    if (callAccepted) {
      setCallStatus("Connected");
    }
  }, [callAccepted]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-800">Video Chat</h1>
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                connectionStatus === "connected"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {connectionStatus}
            </span>
          </div>
          <div className="bg-gray-100 px-4 py-2 rounded-lg">
            <span className="text-sm text-gray-600">Your ID: </span>
            <span className="font-mono text-sm">{myid}</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto py-8 px-4">
        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Local Video */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">
                  Your Video
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={toggleAudio}
                    className={`p-2 rounded-full transition-all ${
                      isAudioEnabled
                        ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}
                    title={isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
                  >
                    {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button
                    onClick={toggleVideo}
                    className={`p-2 rounded-full transition-all ${
                      isVideoEnabled
                        ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}
                    title={isVideoEnabled ? "Turn Off Video" : "Turn On Video"}
                  >
                    {isVideoEnabled ? (
                      <Video size={20} />
                    ) : (
                      <VideoOff size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="relative bg-gray-900 aspect-video">
              <video
                id="user-video"
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${
                  !isVideoEnabled ? "hidden" : ""
                }`}
              ></video>
              {!isVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="text-center">
                    <VideoOff
                      size={48}
                      className="text-gray-400 mx-auto mb-2"
                    />
                    <span className="text-gray-400">Video Off</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Remote Video */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">
                  Remote Video
                </h2>
                {callAccepted && (
                  <div className="flex space-x-2">
                    <div
                      className={`p-2 rounded-full ${
                        remoteAudioEnabled
                          ? "bg-blue-100 text-blue-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {remoteAudioEnabled ? (
                        <Mic size={20} />
                      ) : (
                        <MicOff size={20} />
                      )}
                    </div>
                    <div
                      className={`p-2 rounded-full ${
                        remoteVideoEnabled
                          ? "bg-blue-100 text-blue-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {remoteVideoEnabled ? (
                        <Video size={20} />
                      ) : (
                        <VideoOff size={20} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="relative bg-gray-900 aspect-video">
              {callAccepted ? (
                <>
                  <video
                    id="peer-video"
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover ${
                      !remoteVideoEnabled ? "hidden" : ""
                    }`}
                  ></video>
                  {!remoteVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="text-center">
                        <VideoOff
                          size={48}
                          className="text-gray-400 mx-auto mb-2"
                        />
                        <span className="text-gray-400">Video Off</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="text-center">
                    <Phone size={48} className="text-gray-400 mx-auto mb-2" />
                    <span className="text-gray-400">
                      {callStatus || "Not connected"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Call Controls */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              type="text"
              value={remoteUser}
              onChange={(e) => setRemoteUser(e.target.value)}
              placeholder="Enter remote user ID"
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            <div className="flex gap-4">
              <button
                onClick={newCall}
                disabled={
                  !myid || callAccepted || connectionStatus !== "connected"
                }
                className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                  !myid || callAccepted || connectionStatus !== "connected"
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                <Phone size={20} />
                <span>Call</span>
              </button>
              <button
                onClick={leaveCall}
                disabled={!callAccepted}
                className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                  !callAccepted
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                <PhoneOff size={20} />
                <span>End</span>
              </button>
            </div>
          </div>
          {searching && (
            <div className="mt-4 text-blue-600 text-sm">{searching}</div>
          )}
          {callStatus && !searching && (
            <div className="mt-4 text-green-600 text-sm">{callStatus}</div>
          )}
        </div>
      </main>
    </div>
  );
}
