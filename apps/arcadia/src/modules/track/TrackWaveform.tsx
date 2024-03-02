import { useCallback, useEffect, useRef, useState } from "react";
import { WavesurferProps, useWavesurfer } from "@wavesurfer/react";
import { Box } from "@radix-ui/themes";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import WaveSurfer, { WaveSurferOptions } from "arcadia-wavesurfer";
import { css } from "@/styles/css";
import { Track } from "@/types";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { getAudioData } from "@/lib/getAudioData";
import { useDebounce } from "@/hooks/useDebounce";
import debounce from "lodash.debounce";

interface TrackWaveformProps {
  src: string;
  track: Track;
  height: number;
}

export const TrackWaveform = (props: TrackWaveformProps) => {
  const [idleTopColor, setIdleTopColor] = useState<string | undefined>();
  const [activeTopColor, setActiveTopColor] = useState<string | undefined>();
  const [idleBottomColor, setIdleBottomColor] = useState<string | undefined>();
  const [activeBottomColor, setActiveBottomColor] = useState<string | undefined>();
  const [scrubbedValue, setScrubbedValue] = useState<number | undefined>(0);
  const [scrubbing, setScrubbing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { audioRef, currentTrackId, audioCtxRef, currentTime, setCurrentTime } = useAudioPlayer();
  const ws = useRef<WaveSurfer | null>(null);
  const interactionCounter = useRef(0);

  const isCurrentTrack = currentTrackId === props.track.txid;

  const { data: audioData } = useQuery({
    queryKey: [`peaks-${props.track.txid}`],
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (!audioCtxRef.current) {
        return;
      }

      return getAudioData({ txid: props.track.txid, audioContext: audioCtxRef.current });
    },
  });

  useEffect(() => {
    if (containerRef.current && audioData) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Define the waveform gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 1.35);
        gradient.addColorStop(0, idleTopColor || "#EDEDED"); // Top color
        gradient.addColorStop((canvas.height * 0.4) / canvas.height, idleTopColor || "#EDEDED"); // Top color
        gradient.addColorStop((canvas.height * 0.4 + 1) / canvas.height, "#888"); // White line
        gradient.addColorStop((canvas.height * 0.4 + 2) / canvas.height, "#888"); // White line
        gradient.addColorStop(
          (canvas.height * 0.4 + 3) / canvas.height,
          idleBottomColor || "#B1B1B1"
        ); // Bottom color
        gradient.addColorStop(1, idleBottomColor || "#B1B1B1"); // Bottom color

        // Define the progress gradient
        const progressGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 1.35);
        progressGradient.addColorStop(0, activeTopColor || "#EE772F"); // Top color
        progressGradient.addColorStop(
          (canvas.height * 0.4) / canvas.height,
          activeTopColor || "#EB4926"
        ); // Top color
        progressGradient.addColorStop((canvas.height * 0.4 + 1) / canvas.height, "#888"); // White line
        progressGradient.addColorStop((canvas.height * 0.4 + 2) / canvas.height, "#888"); // White line
        progressGradient.addColorStop(
          (canvas.height * 0.4 + 3) / canvas.height,
          activeBottomColor || "#F6B094"
        ); // Bottom color
        progressGradient.addColorStop(1, activeBottomColor || "#F6B094"); // Bottom color

        ws.current = WaveSurfer.create({
          container: containerRef.current,
          waveColor: gradient,
          progressColor: progressGradient,
          height: props.height || 100,
          barWidth: 2,
          peaks: audioData.peaks,
          duration: audioData.duration,
          normalize: true,
          dragToSeek: true,
        });

        if (ws.current) {
          return () => ws.current?.destroy();
        }
      }
    }
  }, [audioData]);

  const handleInteraction = (e: number) => {
    if (!ws.current || !audioRef.current || !audioData) return;

    const newTime = e * audioData.duration;

    if (isCurrentTrack) {
      console.log("clicked!", newTime);
      audioRef.current.currentTime = newTime;
      setCurrentTime?.(newTime);
    }

    // ws.current.seekTo(e / audioData.duration);
  };

  const handleDragStart = (e: number) => {
    console.log("dragstart");
    setScrubbing(true);
  };

  const handleDrag = (e: number) => {
    setScrubbedValue(e);
  };

  const handleDragEnd = (e: number) => {
    if (!audioRef.current || !audioData?.duration) return;

    const newTime = e * audioData.duration;

    if (isCurrentTrack) {
      audioRef.current.currentTime = newTime;
      setCurrentTime?.(newTime);
      console.log(newTime);
      setScrubbing(false);
    }
  };

  useEffect(() => {
    ws.current?.on("click", (e) => handleInteraction(e));
    ws.current?.on("dragstart", (e) => handleDragStart(e));
    ws.current?.on("drag", (e) => handleDrag(e));
    ws.current?.on("dragend", (e) => handleDragEnd(e));

    return () => {
      ws.current?.on("click", (e) => handleInteraction(e));
      ws.current?.on("dragstart", (e) => handleDragStart(e));
      ws.current?.on("drag", (e) => handleDrag(e));
      ws.current?.on("dragend", (e) => handleDragEnd(e));
    };
  }, [ws.current, audioData, currentTrackId]);

  useEffect(() => {
    if (!ws.current || !audioData?.duration) return;
    const seekToValue = currentTime / audioData.duration;

    console.log({ currentTime });

    if (currentTime >= 0) {
      ws.current.seekTo(seekToValue);
    }
  }, [currentTime]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const style = getComputedStyle(document.documentElement);
      const gray8 = style.getPropertyValue("--white-a8").trim();
      const gray11 = style.getPropertyValue("--white-a11").trim();

      if (containerRef.current) {
        const containerStyles = getComputedStyle(containerRef.current);
        const accent11 = containerStyles.getPropertyValue("--accent-9").trim();
        const accent5 = containerStyles.getPropertyValue("--accent-11").trim();
        setActiveTopColor(accent11);
        setActiveBottomColor(accent5);
      }

      setIdleTopColor(gray11);
      setIdleBottomColor(gray8);
    }
  }, []);

  return (
    <Box
      id="wavesurfer"
      ref={containerRef}
      pt="5"
      style={css({ height: props.height || 100, maxWidth: "100%" })}
    />
  );
};