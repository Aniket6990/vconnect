"use client";
import { useEffect, useRef, useState, createContext } from "react";
import { io as socketIO } from "socket.io-client";
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
  const connectionRef = useRef<Instance>();
  const socket = useRef<any>();

  const localPeer = useRef<Instance>();
  useEffect(() => {
    socket.current = socketIO("http://localhost:4000", {
      transports: ["websocket"],
    }).connect();

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      setLocalStream(stream);
      const localVideo = document.querySelector(
        "#user video"
      ) as HTMLVideoElement;
      localVideo.srcObject = stream;
    });
    socket.current.on("id", (id: string) => {
      setId(id);
    });

    socket.current.on("calling", (data: any) => {
      const { from, signal, to } = data;
      setCall({ isReceivingCall: true, from, signal, to });
    });

    socket.current.on("searching", (msg: string) => {
      setSearching(msg);
    });

    return () => {
      socket.current.disconnect();
    };
  }, []);

  const answerCall = () => {
    setSearching("");
    setCallAccepted(true);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: localStream,
    });

    peer.on("signal", (myData) => {
      console.log(`myid: `, myid);
      socket.current.emit("callAccepted", {
        id: call.from,
        from: call.to,
        signal: myData,
      });
    });

    peer.on("stream", (stream) => {
      console.log("received stream for peer1");
      const remoteUserVideo = document.querySelector(
        "#peer video"
      ) as HTMLVideoElement;
      remoteUserVideo.srcObject = stream;
    });
    console.log(`signal peer1: `, call.signal);
    peer.signal(call.signal);

    connectionRef.current = peer;
  };

  useEffect(() => {
    if (call.isReceivingCall) {
      answerCall();
    }
  }, [call.isReceivingCall]);

  const newCall = () => {
    setSearching("");
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: localStream,
    });

    peer.on("signal", (data) => {
      socket.current.emit("callUser", {
        from: myid,
        signal: data,
      });
    });

    socket.current.on("accepted", (data: any) => {
      const { from, signal, id } = data;
      console.log(`${from} has accepted`);
      setCallAccepted(true);
      setCall({ isReceivingCall: true, from, to: id, signal });
      peer.signal(signal);
    });

    peer.on("stream", (stream) => {
      setCallAccepted(true);
      console.log("received stream for peer2");
      const remoteUserVideo = document.querySelector(
        "#peer video"
      ) as HTMLVideoElement;
      remoteUserVideo.srcObject = stream;
    });
    localPeer.current = peer;
  };

  const leaveCall = () => {
    if (localPeer.current) {
      localPeer.current.destroy();
    } else {
      connectionRef.current?.destroy();
    }
    socket.current.emit("cutCall", { id: call.to, from: call.from });
    setCallAccepted(false);
    setCall({ isReceivingCall: false, from: "", signal: "", to: "" });
  };

  return (
    <main className="flex flex-col justify-start items-center h-screen w-full">
      <div>
        <span>{myid}</span>
      </div>
      <div className="w-full flex justify-between items-center p-4">
        <div id="user">
          <video autoPlay></video>
        </div>
        <div id="peer">
          <video autoPlay></video>
        </div>
      </div>
      {call.isReceivingCall !== false && <span>Connected to {call.from}</span>}
      <div className="flex w-1/2 justify-center items-center gap-4 my-4">
        <input
          type="text"
          className="border-2 border-blue-400 rounded-md p-4"
          value={remoteUser}
          onChange={(e) => {
            setRemoteUser(e.target.value);
          }}
        />
        <button
          className="border-2 border-blue-400 rounded-md p-4"
          onClick={(e) => {
            newCall();
          }}
        >
          call
        </button>
        <button
          className="border-2 border-blue-400 rounded-md p-4"
          onClick={(e) => {
            leaveCall();
          }}
        >
          Destroy
        </button>
        {searching !== "" && <span>{searching}</span>}
      </div>
    </main>
  );
}
