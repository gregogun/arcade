import { Track as TrackType } from "@/types";
import { Flex } from "@/ui/Flex";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getTrack } from "@/lib/getTrack";
import { Image } from "@/ui/Image";
import { Box } from "@/ui/Box";
import { useEffect, useState } from "react";
import { IoPauseSharp, IoPlaySharp } from "react-icons/io5";
import { useAudioPlayer } from "@/hooks/AudioPlayerContext";
import { IconButton } from "@/ui/IconButton";
import { Typography } from "@/ui/Typography";
import {
  abbreviateAddress,
  timestampToDate,
  userPreferredGateway,
} from "@/utils";
import { Button } from "@/ui/Button";
import { getProfile } from "@/lib/getProfile";
import { appConfig } from "@/appConfig";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui/Accordion";
import { styled } from "@/stitches.config";
import { RxCheck, RxClipboardCopy, RxCopy } from "react-icons/rx";
import { getStampCount, hasStampedTx, stamp } from "@/lib/stamps";
import { BsChat, BsHeart, BsSuitHeart, BsSuitHeartFill } from "react-icons/bs";
import { useConnect } from "arweave-wallet-ui-test";
import { ConnectPrompt } from "../layout/ConnectPrompt";
import { useDebounce } from "@/hooks/useDebounce";
import { TrackCommentsDialog } from "./TrackCommentsDialog";
import { getCommentCount } from "@/lib/comments";
import { LikeButton } from "./components/LikeButton";

const AccordionContentItem = styled(Flex, {
  mt: "$2",

  "& p": {
    color: "$slate12",
  },

  "& p:first-child": {
    color: "$slate11",

    "&[data-txid-detail]": {
      color: "$slate12",
    },
  },
});

const Description = styled(Typography, {
  display: "-webkit-box",
  "-webkit-line-clamp": 1,
  "-webkit-box-orient": "vertical",
  overflow: "hidden",
  maxWidth: "25ch",
});

export const Track = () => {
  const [isCopied, setIsCopied] = useState(false);
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);
  // local state for instant visual feedback
  const [localStamped, setLocalStamped] = useState(false);
  // local stamp count for instant visual feedback
  const [localStampCount, setLocalStampCount] = useState(0);
  // temp solution, connect method from sdk should prob return a promise
  const [userConnect, setUserConnect] = useState(false);
  const [showCommentsDialog, setShowCommentsDialog] = useState(false);
  const location = useLocation();
  const query = location.search;
  const urlParams = new URLSearchParams(query);
  const { walletAddress, connect } = useConnect();

  const handleShowConnectPrompt = () => setShowConnectPrompt(true);
  const handleCancelConnectPrompt = () => setShowConnectPrompt(false);

  const handleShowCommentsDialog = () => setShowCommentsDialog(true);
  const handleCancelCommentsDialog = () => setShowCommentsDialog(false);

  const {
    audioRef,
    playing,
    togglePlaying,
    currentTrackId,
    setTracklist,
    setCurrentTrackId,
    setCurrentTrackIndex,
    audioCtxRef,
  } = useAudioPlayer();

  const id = urlParams.get("tx");

  if (!id) {
    // return no track view
    // return;
  }

  const { data: track, isError } = useQuery({
    queryKey: [`track-${id}`],
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (!id) {
        throw new Error("No track ID has been found");
      }

      return getTrack(id, audioCtxRef);
    },
    onSuccess: (data) => {
      console.log({ data });
    },
  });

  const { data: account } = useQuery({
    queryKey: [`profile-${track?.creator}`],
    queryFn: () => {
      if (!track?.creator) {
        throw new Error("No profile has been found");
      }

      return getProfile(track.creator);
    },
  });

  const { data: commentCount } = useQuery({
    queryKey: [`comment-count-${track?.txid}`],
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (!track?.txid) {
        throw new Error("No txid found");
      }

      return getCommentCount(track.txid);
    },
  });

  const { data: stamps } = useQuery({
    queryKey: [`stampCount-${id}`],
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (!id) {
        throw new Error("No track ID has been found");
      }

      return getStampCount(id);
    },
    onError: (error) => {
      console.error(error);
    },
  });

  const { data: stamped, refetch } = useQuery({
    queryKey: [`stamped-${id}`],
    enabled: !!walletAddress,
    queryFn: () => {
      if (!id) {
        throw new Error("No track ID has been found");
      }

      if (!walletAddress) {
        throw new Error("No wallet address found");
      }

      return hasStampedTx(id, walletAddress);
    },
    onSuccess: (data) => {
      console.log(data);
      setLocalStamped(false);
    },
    onError: (error) => {
      console.error(error);
    },
  });

  useEffect(() => {
    if (walletAddress && userConnect && id) {
      setUserConnect(false);
      handleCancelConnectPrompt();
      mutation.mutate(id);
      setLocalStamped(true);
    }
  }, [walletAddress]);

  const debounceRequest = useDebounce(() => {
    refetch();
  }, 450);

  const mutation = useMutation({
    mutationFn: stamp,
    //@ts-ignore
    onSuccess: () => {
      debounceRequest();
      if (stamps) {
        setLocalStampCount(stamps.total + 1);
      }
    },
    onError: (error: any) => {
      console.error(error);
      setLocalStamped(false);
    },
  });

  if (!track && isError) {
    // return error view
  }

  if (!track) {
    // return;
  }

  const handleClick = () => {
    if (!track) {
      return;
    }
    if (currentTrackId === track?.txid) {
      togglePlaying?.();
      handlePlayPause();
    } else {
      setTracklist?.([track]);
      setCurrentTrackId?.(track.txid);
      setCurrentTrackIndex?.(0);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  };

  const handleCopy = (tx: string | undefined) => {
    if (!tx) {
      return;
    }
    navigator.clipboard.writeText(tx).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  const handleStamp = () => {
    if (!id || stamped || localStamped) {
      return;
    }

    if (walletAddress) {
      setLocalStamped(true);
      mutation.mutate(id);
    } else {
      handleShowConnectPrompt();
    }
  };

  const handleConnectAndStamp = async () => {
    if (!track?.txid || stamped) {
      return;
    }

    /* as we can't await below connect method we need to check
      if user tried to connect and use presence of this state var and walletAddress to initiate like
      and close dialog
    */

    connect({ appName: "Arcadia", walletProvider: "arweave.app" });

    setUserConnect(true);
  };

  const isPlaying = playing && currentTrackId === track?.txid;

  const avatarUrl = account?.profile.avatarURL;

  const isCreator = track && track.creator === walletAddress;

  return (
    <Flex
      direction={{
        "@initial": "column",
        "@bp4": "row",
      }}
      gap="10"
      align={{
        "@initial": "center",
        "@bp4": "start",
      }}
    >
      <Box
        css={{
          backgroundColor: "$slate2",

          width: 200,
          height: 200,

          "@bp2": {
            width: 400,
            height: 400,
          },

          "@bp3": {
            width: 500,
            height: 500,
          },

          "@bp5": {
            width: 600,
            height: 600,
          },
        }}
      >
        {track && (
          <Image
            css={{
              aspectRatio: 1 / 1,
              width: "100%",
              height: "100%",
            }}
            src={
              track.artworkId
                ? `https://arweave.net/${track.artworkId}`
                : `https://source.boringavatars.com/marble/200/${track.txid}?square=true`
            }
          />
        )}
      </Box>
      <Flex
        direction="column"
        gap="10"
        css={{ flex: 1, "@bp4": { maxWidth: 500 } }}
      >
        <Flex gap="3" align="center">
          <IconButton
            css={{
              br: 9999,
              color: "$slate1",
              backgroundColor: "$slate12",
              opacity: 0.9,
              width: 64,
              height: 64,

              "& svg": {
                fontSize: 28,
                transform: isPlaying ? "translateX(0)" : "translateX(1px)",
              },

              "&:hover": {
                backgroundColor: "$slate11",
                opacity: 0.9,
              },

              "&:active": {
                transform: "scale(0.95)",
              },
            }}
            size="3"
            data-playing={isPlaying}
            aria-checked={isPlaying}
            role="switch"
            onClick={handleClick}
          >
            {isPlaying ? <IoPauseSharp /> : <IoPlaySharp />}
          </IconButton>
          <Flex direction="column">
            <Typography contrast="hi" size="6">
              {track?.title}
            </Typography>
            <Typography size="4">
              {account?.profile.name ||
                abbreviateAddress({
                  address: track?.creator,
                  options: { startChars: 6, endChars: 6 },
                })}
            </Typography>
          </Flex>
        </Flex>
        <Flex css={{ alignSelf: "start" }} direction="column" gap="7">
          <Link
            to={{
              pathname: "/profile",
              search: `?addr=${track?.creator}`,
            }}
          >
            <Flex gap="3" align="center">
              {account ? (
                <Image
                  css={{
                    width: 40,
                    height: 40,
                    br: 9999,
                  }}
                  src={
                    avatarUrl === appConfig.accountAvatarDefault
                      ? `https://source.boringavatars.com/marble/100/${account?.txid}?square=true`
                      : avatarUrl
                  }
                />
              ) : (
                <Box
                  css={{
                    width: 40,
                    height: 40,
                    backgroundColor: "$slate3",
                    br: 9999,
                  }}
                />
              )}
              <Typography size="4">
                {account?.profile.name ||
                  abbreviateAddress({
                    address: track?.creator,
                    options: { startChars: 6, endChars: 6 },
                  })}
              </Typography>
            </Flex>
          </Link>
          <Typography
            css={{
              // fix needed: webkit-box removes space between this section and button
              display: "-webkit-box",
              "-webkit-line-clamp": 2,
              "-webkit-box-orient": "vertical",
              overflow: "hidden",
              maxWidth: "60ch",
            }}
          >
            {track?.description || "No track description."}
          </Typography>
        </Flex>
        {track && (
          <Flex gap="5" align="center">
            <Button
              as="a"
              href={`https://bazar.arweave.dev/#/asset/${track?.txid}`}
              css={{ alignSelf: "start", br: "$2", cursor: "pointer" }}
              variant="solid"
            >
              View on Bazar
            </Button>
            <Flex align="center" gap="5">
              <LikeButton txid={id} size="3" />

              <IconButton
                onClick={handleShowCommentsDialog}
                size="3"
                variant="transparent"
              >
                <BsChat />
              </IconButton>

              <TrackCommentsDialog
                open={showCommentsDialog}
                onClose={handleCancelCommentsDialog}
                txid={track.txid}
                creator={track.creator}
              />

              <ConnectPrompt
                open={showConnectPrompt}
                onClose={handleCancelConnectPrompt}
                title="Connect your wallet to proceed"
                description="In order to perform this action, you need to connect an Arweave
                      wallet."
              >
                <Button
                  onClick={handleConnectAndStamp}
                  css={{
                    mt: "$5",
                  }}
                  variant="solid"
                >
                  Connect and Like
                  <BsSuitHeartFill />
                </Button>
              </ConnectPrompt>
            </Flex>
          </Flex>
        )}
        {track && (
          <Accordion type="multiple">
            <AccordionItem value="track_details">
              <AccordionTrigger>Track Details</AccordionTrigger>
              <AccordionContent>
                <AccordionContentItem justify="between">
                  <Typography>Title</Typography>
                  <Typography>{track.title}</Typography>
                </AccordionContentItem>
                <AccordionContentItem justify="between">
                  <Typography>Description</Typography>
                  <Description>{track.description}</Description>
                </AccordionContentItem>
                <AccordionContentItem justify="between">
                  <Typography>Duration</Typography>
                  <Typography>{track.duration}</Typography>
                </AccordionContentItem>
                <AccordionContentItem justify="between">
                  <Typography>Genre</Typography>
                  <Typography>{track.genre}</Typography>
                </AccordionContentItem>
              </AccordionContent>
            </AccordionItem>
            <Box css={{ height: 1, backgroundColor: "$slate6", my: "$2" }} />
            <AccordionItem value="provenance_details">
              <AccordionTrigger>Provenance Details</AccordionTrigger>
              <AccordionContent>
                <AccordionContentItem justify="between">
                  <Typography>Transaction ID</Typography>
                  <Flex align="center" gap="1">
                    <Typography data-txid-detail>
                      {abbreviateAddress({
                        address: track.txid,
                        options: { startChars: 6, endChars: 6 },
                      })}
                    </Typography>
                    <IconButton
                      onClick={() => handleCopy(track.txid)}
                      variant="transparent"
                      css={{
                        pointerEvents: isCopied ? "none" : "auto",
                        color: isCopied ? "$green11" : "$slate11",
                      }}
                      size="1"
                    >
                      {isCopied ? <RxCheck /> : <RxCopy />}
                    </IconButton>
                  </Flex>
                </AccordionContentItem>
                <AccordionContentItem justify="between">
                  <Typography>Date Created</Typography>
                  <Typography>{timestampToDate(track.dateCreated)}</Typography>
                </AccordionContentItem>
              </AccordionContent>
            </AccordionItem>
            {track.license?.tx && (
              <>
                <Box
                  css={{ height: 1, backgroundColor: "$slate6", my: "$2" }}
                />
                <AccordionItem value="license">
                  <AccordionTrigger>License Information</AccordionTrigger>
                  <AccordionContent>
                    <AccordionContentItem justify="between">
                      <Typography
                        css={{
                          color: "$slate12",
                          boxShadow: "0 1px 0 0 $colors$slate12",
                          mb: "$3",

                          "&:hover": {
                            color: "$blue11",
                            boxShadow: "0 1px 0 0 $colors$blue11",
                          },
                        }}
                        as="a"
                        href={`${
                          userPreferredGateway() || appConfig.defaultGateway
                        }/${track.license?.tx}`}
                      >
                        License Text
                      </Typography>
                    </AccordionContentItem>

                    {track?.license?.commercial && (
                      <AccordionContentItem justify="between">
                        <Typography>Commercial Use</Typography>
                        <Typography>{track.license.commercial}</Typography>
                      </AccordionContentItem>
                    )}
                    {track?.license?.derivative && (
                      <AccordionContentItem justify="between">
                        <Typography>Derivative</Typography>
                        <Typography>{track.license.derivative}</Typography>
                      </AccordionContentItem>
                    )}
                    {track?.license?.licenseFee && (
                      <AccordionContentItem justify="between">
                        <Typography>License Fee</Typography>
                        <Typography>{track.license.licenseFee}</Typography>
                      </AccordionContentItem>
                    )}
                    {track?.license?.paymentMode && (
                      <AccordionContentItem justify="between">
                        <Typography>Payment Mode</Typography>
                        <Typography>{track.license.paymentMode}</Typography>
                      </AccordionContentItem>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </>
            )}
          </Accordion>
        )}
      </Flex>
    </Flex>
  );
};
