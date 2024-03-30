"use client";
import { useEffect, useRef, useState } from "react";
import { io as socketIO } from "socket.io-client";

export default function Home() {
  const [localStream, setLocalStream] = useState<MediaStream>();
  const userVideo = useRef<MediaStream>();
  useEffect(() => {
    const io = socketIO("http://localhost:4000", {
      transports: ["websocket"],
    }).connect();

    io.emit("msg", "hi, mom");

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      setLocalStream(stream);
      const video = document.getElementById("user") as HTMLVideoElement;
      video.srcObject = stream;
      const localPeerConnection = new RTCPeerConnection();
    });
    return () => {
      io.disconnect();
    };
  }, []);

  return (
    <main>
      <video autoPlay id="user"></video>
    </main>
  );
}
