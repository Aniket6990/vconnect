import { PiMicrophoneFill, PiMicrophoneSlashFill } from "react-icons/pi";
import { HiVideoCamera, HiVideoCameraSlash } from "react-icons/hi2";
export default function Footer(props: {
  onCall: boolean;
  newcall: () => void;
  controlVideo: () => void;
  controlAudio: () => void;
  toggleVideo: boolean;
  toggleAudio: boolean;
  leaveCall: () => void;
}) {
  const {
    onCall,
    newcall,
    controlAudio,
    controlVideo,
    toggleAudio,
    toggleVideo,
    leaveCall,
  } = props;
  return (
    <div className="w-full py-4 px-4 flex justify-center gap-2 items-center border-t-2 border-solid border-app_grey border-opacity-15 relative">
      <button
        className="w-10 h-10 rounded-full border-2 border-dark flex justify-center items-center"
        onClick={(e) => {
          controlAudio();
        }}
      >
        {toggleAudio ? (
          <PiMicrophoneFill className="h-6 w-6" />
        ) : (
          <PiMicrophoneSlashFill className="h-6 w-6" />
        )}
      </button>
      <button
        className="w-10 h-10 rounded-full border-2 border-dark flex justify-center items-center"
        onClick={(e) => {
          controlVideo();
        }}
      >
        {toggleVideo ? (
          <HiVideoCamera className="h-6 w-6" />
        ) : (
          <HiVideoCameraSlash className="h-6 w-6" />
        )}
      </button>
      {!onCall ? (
        <button
          className="py-2 px-8 bg-green-500 text-light text-sm rounded-lg absolute right-8"
          onClick={(e) => {
            newcall();
          }}
        >
          Start
        </button>
      ) : (
        <button
          className="py-2 px-8 bg-app_red text-light text-sm rounded-lg absolute right-8"
          onClick={(e) => {
            leaveCall();
          }}
        >
          Leave
        </button>
      )}
    </div>
  );
}
