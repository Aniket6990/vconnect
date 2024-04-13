"use client";
import { useEffect, useRef, useState, createContext } from "react";
import { io as socketIO } from "socket.io-client";
import Peer from "simple-peer";

const appContext = createContext({});

export default function Home() {
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [myid, setId] = useState<string>("");
  const [remoteUser, setRemoteUser] = useState<string>("");
  const [remoteSignal, setRemoteSignal] = useState<any>();
  const socket = useRef<any>();

  const localPeer = useRef<any>();
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

    socket.current.emit("msg", "hi, mom");

    socket.current.on("id", (id: string) => {
      setId(id);
    });

    socket.current.on("calling", (data: any) => {
      const { from, signal, to } = data;
      console.log(`${from} is calling`);
      const peer = new Peer({ initiator: false, stream: localStream });

      peer.on("signal", (data) => {
        console.log(`myid: `, myid);
        socket.current.emit("callAccepted", {
          id: from,
          from: to,
          signal: data,
        });
      });

      peer.on("stream", (stream) => {
        const remoteUserVideo = document.querySelector(
          "#peer video"
        ) as HTMLVideoElement;
        remoteUserVideo.srcObject = stream;
      });

      peer.signal(signal);
    });

    socket.current.on("accepted", (data: any) => {
      const { from, signal } = data;
      console.log(`${from} has accepted`);
      setRemoteSignal(signal);
      localPeer.current.signal(signal);
    });

    return () => {
      socket.current.disconnect();
    };
  }, []);

  const call = () => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: localStream,
    });

    peer.on("signal", (data) => {
      socket.current.emit("callUser", {
        id: remoteUser,
        from: myid,
        signal: data,
      });
    });

    peer.on("stream", (stream) => {
      const remoteUserVideo = document.querySelector(
        "#peer video"
      ) as HTMLVideoElement;
      remoteUserVideo.srcObject = stream;
    });

    localPeer.current = peer;
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
      <div className="flex w-1/2 justify-center items-center gap-4">
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
            call();
          }}
        >
          call
        </button>
      </div>
    </main>
  );
}
