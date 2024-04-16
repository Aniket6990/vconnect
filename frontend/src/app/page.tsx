"use client";
import { useEffect, useRef, useState, createContext } from "react";
import { io as socketIO } from "socket.io-client";
import Peer, { Instance } from "simple-peer";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MagnifyingGlass } from "react-loader-spinner";
import { space } from "postcss/lib/list";

export default function Home() {
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [myid, setId] = useState<string>("");
  const [remoteUserStream, setRemoteUserStream] = useState<MediaStream>();
  const [call, setCall] = useState({
    isReceivingCall: false,
    from: "",
    signal: "",
    to: "",
  });
  const [searching, setSearching] = useState<string>("");
  const [callAccepted, setCallAccepted] = useState(false);
  const [toggleVideo, setToggleVideo] = useState(true);
  const [toggleAudio, setToggleAudio] = useState(true);
  const connectionRef = useRef<Instance>();
  const socket = useRef<any>();

  const localPeer = useRef<Instance>();
  useEffect(() => {
    socket.current = socketIO("http://localhost:4000", {
      transports: ["websocket"],
    }).connect();

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        const localVideo = document.querySelector("#user") as HTMLVideoElement;
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

    socket.current.on("peerout", (data: any) => {
      const { id } = data;
      console.log(`${id} out`);
      setCallAccepted(false);
      setCall({ isReceivingCall: false, from: "", signal: "", to: "" });
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
        "#peer"
      ) as HTMLVideoElement;
      remoteUserVideo.srcObject = stream;
    });
    peer.signal(call.signal);

    connectionRef.current = peer;
  };

  useEffect(() => {
    if (call.isReceivingCall) {
      answerCall();
    }
  }, [call.isReceivingCall]);

  const newCall = () => {
    console.log("initiating call");
    socket.current.off("cutCall");
    setSearching("");
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: localStream,
    });

    peer.on("signal", (data) => {
      console.log("new call request");
      socket.current.emit("callUser", {
        from: myid,
        signal: data,
      });
    });

    socket.current.on("accepted", (data: any) => {
      console.log("request accepted");
      const { from, signal, id } = data;
      setCallAccepted(true);
      setCall({ isReceivingCall: true, from, to: id, signal });
      peer.signal(signal);
    });

    peer.on("stream", (stream) => {
      setCallAccepted(true);
      const remoteUserVideo = document.querySelector(
        "#peer"
      ) as HTMLVideoElement;
      remoteUserVideo.srcObject = stream;
    });
    localPeer.current = peer;
  };

  const leaveCall = () => {
    if (localPeer.current) {
      localPeer.current.destroy();
      localPeer.current = undefined; // Reset localPeer.current to undefined
      socket.current.off("callUser");
      socket.current.off("accepted");
    } else {
      connectionRef.current?.destroy();
      connectionRef.current = undefined;
      socket.current.off("calling");
      socket.current.off("callAccepted"); // Reset connectionRef.current to undefined
    }

    socket.current.emit("cutCall", { id: call.to, from: call.from });
    setCallAccepted(false);
    setCall({ isReceivingCall: false, from: "", signal: "", to: "" });
    localPeer.current = undefined;
    connectionRef.current = undefined;
  };

  const controlVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];

      if (videoTrack.enabled) {
        videoTrack.enabled = false;

        setToggleVideo(false);
      } else {
        videoTrack.enabled = true;
        setToggleVideo(true);
      }
    }
  };

  const controlAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];

      if (audioTrack.enabled) {
        audioTrack.enabled = false;
        setToggleAudio(false);
      } else {
        audioTrack.enabled = true;
        setToggleAudio(true);
      }
    }
  };

  return (
    <main className="flex flex-col justify-start items-center h-screen w-full relative">
      <Navbar />
      {searching && <span>{searching}</span>}
      <div
        id="peers"
        className="p-8 h-full w-full flex justify-center items-center gap-8 relative"
      >
        <div className="h-full w-1/2 border-2 border-app_purple border-solid rounded-lg relative">
          <video
            id="user"
            autoPlay={true}
            playsInline={true}
            muted={true}
            className="h-auto w-full rounded-md"
          ></video>
          <span className="absolute top-4 left-4 px-2 py-1 bg-app_grey rounded-full text-sm text-light">
            video
          </span>
        </div>
        <div className="h-full w-1/2 border-2 border-app_purple border-solid rounded-lg relative flex justify-center items-center">
          {call.isReceivingCall ? (
            <video id="peer" autoPlay className="h-full w-full"></video>
          ) : (
            <MagnifyingGlass
              color="#8E8D93"
              visible={true}
              ariaLabel="Searching"
              glassColor="#A59BFC"
              height={80}
              width={80}
            />
          )}
          <span className="absolute top-4 left-4 px-2 py-1 bg-app_grey rounded-full text-sm text-light">
            video
          </span>
        </div>
      </div>
      <Footer
        onCall={callAccepted}
        newcall={newCall}
        controlVideo={controlVideo}
        controlAudio={controlAudio}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        leaveCall={leaveCall}
      />
    </main>
  );
}
