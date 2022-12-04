/* eslint-disable no-console */
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons/faCaretDown';
import { faCaretRight } from '@fortawesome/free-solid-svg-icons/faCaretRight';
import { faMicrophoneSlash } from '@fortawesome/free-solid-svg-icons/faMicrophoneSlash';
import { faVolumeMute } from '@fortawesome/free-solid-svg-icons/faVolumeMute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Overlay from 'react-bootstrap/Overlay';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import styled from 'styled-components';
import Flags from '../../Flags';
import MeteorUsers from '../../lib/models/MeteorUsers';
import { PeerType } from '../../lib/schemas/mediasoup/Peer';
import { Action, CallState } from '../hooks/useCallState';
import Avatar from './Avatar';
import Loading from './Loading';
import Spectrum from './Spectrum';
import {
  AVActions,
  AVButton,
  ChatterSubsection, ChatterSubsectionHeader, PeopleItemDiv, PeopleListDiv,
} from './styling/PeopleComponents';

const CallStateIcon = styled.span`
  font-size: 12px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: red; // TODO: lift $danger from react-bootstrap somehow?
  position: absolute;
  right: 0;
`;

const MutedIcon = styled(CallStateIcon)`
  top: 0;
`;

const DeafenedIcon = styled(CallStateIcon)`
  bottom: 0;
`;

// If we're waiting for a particular piece of server state for more than 1s,
// something might be wrong so throw up a warning
const JoiningCall = ({ details }: { details?: string }) => {
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const handle = Meteor.setTimeout(() => setShowAlert(true), 1000);
    return () => Meteor.clearTimeout(handle);
  }, []);

  if (!showAlert) {
    return null;
  }

  return (
    <Alert variant="warning">
      <p>
        <Loading inline />
        Waiting for server to confirm your connection. This can happen if a new version of Jolly
        Roger was just deployed or if one of our servers failed. It should recover on its own
        shortly, but if not try leaving and rejoining the call.
      </p>

      {details && (
        <p>
          Details:
          {' '}
          {details}
        </p>
      )}
    </Alert>
  );
};

const SelfBox = ({
  muted,
  deafened,
  audioContext,
  stream,
  popperBoundaryRef,
}: {
  muted: boolean,
  deafened: boolean,
  audioContext: AudioContext,
  stream: MediaStream,
  popperBoundaryRef: React.RefObject<HTMLElement>,
}) => {
  const spectraDisabled = useTracker(() => Flags.active('disable.spectra'));
  const { userId, name, discordAccount } = useTracker(() => {
    const user = Meteor.user()!;
    return {
      userId: user._id,
      name: user.displayName,
      discordAccount: user.discordAccount,
    };
  });

  return (
    <OverlayTrigger
      placement="bottom"
      popperConfig={{
        modifiers: [
          {
            name: 'preventOverflow',
            enabled: true,
            options: {
              boundary: popperBoundaryRef.current,
              padding: 0,
            },
          },
        ],
      }}
      overlay={(
        <Tooltip id="caller-self">
          <div>You are in the call.</div>
          {muted && <div>You are currently muted and will transmit no audio.</div>}
          {deafened && <div>You are currently deafened and will hear no audio.</div>}
        </Tooltip>
      )}
    >
      <PeopleItemDiv>
        <Avatar _id={userId} displayName={name} discordAccount={discordAccount} size={40} />
        <div>
          {muted && <MutedIcon><FontAwesomeIcon icon={faMicrophoneSlash} /></MutedIcon>}
          {deafened && <DeafenedIcon><FontAwesomeIcon icon={faVolumeMute} /></DeafenedIcon>}
          {!spectraDisabled && !muted && !deafened ? (
            <Spectrum
              width={40}
              height={40}
              audioContext={audioContext}
              stream={stream}
            />
          ) : null}
        </div>
      </PeopleItemDiv>
    </OverlayTrigger>
  );
};

const ChatterTooltip = styled(Tooltip)`
  // Force chatter tooltip overlay to get larger than the default
  // react-bootstrap stylesheet permits.  We can only apply classes to the root
  // tooltip <div>; the .tooltip-inner className is controlled by
  // react-bootstrap/popper.
  .tooltip-inner {
    max-width: 300px;
  }
`;

const PeerBox = ({
  audioContext,
  selfDeafened,
  peer,
  popperBoundaryRef,
  stream,
}: {
  audioContext: AudioContext,
  selfDeafened: boolean,
  peer: PeerType,
  popperBoundaryRef: React.RefObject<HTMLElement>,
  stream: MediaStream | undefined,
}) => {
  const spectraDisabled = useTracker(() => Flags.active('disable.spectra'));
  const audioRef = React.createRef<HTMLAudioElement>();
  const { userId, name, discordAccount } = useTracker(() => {
    const user = MeteorUsers.findOne(peer.createdBy);
    return {
      userId: user?._id,
      name: user?.displayName,
      discordAccount: user?.discordAccount,
    };
  }, [peer.createdBy]);
  useEffect(() => {
    if (audioRef.current) {
      if (stream) {
        // eslint-disable-next-line no-param-reassign
        audioRef.current.srcObject = stream;
      } else {
        audioRef.current.srcObject = null;
      }
    }
  }, [stream, audioRef]);

  const { muted, deafened } = peer;

  return (
    <OverlayTrigger
      placement="bottom"
      popperConfig={{
        modifiers: [
          {
            name: 'preventOverflow',
            enabled: true,
            options: {
              boundary: popperBoundaryRef.current,
              padding: 0,
            },
          },
        ],
      }}
      overlay={(
        <ChatterTooltip id={`caller-${peer._id}`}>
          <div>{name}</div>
          {muted &&
            <div>Muted (no one can hear them)</div>}
          {deafened &&
            <div>Deafened (they can&apos;t hear anyone)</div>}
        </ChatterTooltip>
      )}
    >
      <PeopleItemDiv>
        <Avatar _id={userId} displayName={name} discordAccount={discordAccount} size={40} />
        <div>
          {muted && <MutedIcon><FontAwesomeIcon icon={faMicrophoneSlash} /></MutedIcon>}
          {deafened && <DeafenedIcon><FontAwesomeIcon icon={faVolumeMute} /></DeafenedIcon>}
          {!spectraDisabled && !muted && stream && stream.getTracks().length > 0 ? (
            <Spectrum
              width={40}
              height={40}
              audioContext={audioContext}
              stream={stream}
            />
          ) : null}
        </div>
        <audio
          autoPlay
          muted={selfDeafened}
          ref={audioRef}
        />
      </PeopleItemDiv>
    </OverlayTrigger>
  );
};

const Callers = ({
  muted,
  deafened,
  audioContext,
  localStream,
  callersExpanded,
  onToggleCallersExpanded,
  otherPeers,
  peerStreams,
}: {
  muted: boolean;
  deafened: boolean;
  audioContext: AudioContext;
  localStream: MediaStream;
  callersExpanded: boolean;
  onToggleCallersExpanded(): void;
  otherPeers: PeerType[];
  peerStreams: Map<string, MediaStream>;
}) => {
  const callersHeaderIcon = callersExpanded ? faCaretDown : faCaretRight;
  const callerCount = otherPeers.length + 1; // +1 for self
  const chatterRef = useRef<HTMLDivElement>(null);

  const peerBoxes = otherPeers.map((peer) => {
    const stream = peerStreams.get(peer._id);
    return (
      <PeerBox
        key={peer._id}
        selfDeafened={deafened}
        audioContext={audioContext}
        peer={peer}
        popperBoundaryRef={chatterRef}
        stream={stream}
      />
    );
  });

  return (
    <ChatterSubsection ref={chatterRef}>
      <ChatterSubsectionHeader onClick={onToggleCallersExpanded}>
        <FontAwesomeIcon fixedWidth icon={callersHeaderIcon} />
        {`${callerCount} caller${callerCount !== 1 ? 's' : ''}`}
      </ChatterSubsectionHeader>
      <PeopleListDiv collapsed={!callersExpanded}>
        <SelfBox
          muted={muted}
          deafened={deafened}
          audioContext={audioContext}
          stream={localStream}
          popperBoundaryRef={chatterRef}
        />
        {peerBoxes}
      </PeopleListDiv>
    </ChatterSubsection>
  );
};

const CallSection = ({
  muted,
  deafened,
  audioContext,
  localStream,
  callersExpanded,
  onToggleCallersExpanded,
  callState,
  callDispatch,
}: {
  muted: boolean;
  deafened: boolean;
  audioContext: AudioContext;
  localStream: MediaStream;
  callersExpanded: boolean;
  onToggleCallersExpanded(): void;
  callState: CallState;
  callDispatch: React.Dispatch<Action>;
}) => {
  const onToggleMute = useCallback(() => {
    callDispatch({ type: 'toggle-mute' });
  }, [callDispatch]);
  const onToggleDeafen = useCallback(() => {
    callDispatch({ type: 'toggle-deafen' });
  }, [callDispatch]);
  const onLeaveCall = useCallback(() => {
    callDispatch({ type: 'leave-call' });
  }, [callDispatch]);
  const onDismissPeerStateNotification = useCallback(() => {
    callDispatch({ type: 'dismiss-peer-state-notification' });
  }, [callDispatch]);

  const muteRef = useRef(null);

  if (!callState.device) {
    return <JoiningCall details="Missing device" />;
  }

  if (!callState.selfPeer) {
    return <JoiningCall details="Missing peer record for self" />;
  }

  if (!callState.router) {
    return <JoiningCall details="Missing router" />;
  }

  return (
    <>
      <AVActions>
        <AVButton
          ref={muteRef}
          variant={muted ? 'secondary' : 'light'}
          size="sm"
          onClick={onToggleMute}
        >
          {muted ? 'Un\u00ADmute' : 'Mute self'}
        </AVButton>
        <AVButton
          variant={deafened ? 'secondary' : 'light'}
          size="sm"
          onClick={onToggleDeafen}
        >
          {deafened ? 'Un\u00ADdeafen' : 'Deafen self'}
        </AVButton>
        <AVButton variant="danger" size="sm" onClick={onLeaveCall}>Leave call</AVButton>
      </AVActions>
      <Overlay target={muteRef.current} show={callState.allowInitialPeerStateNotification && muted} placement="bottom">
        <Tooltip id="muted-on-join-notification">
          <div>
            We&apos;ve left your mic muted for now given the number of people on the
            call.  You can unmute yourself at any time.
          </div>
          <Button onClick={onDismissPeerStateNotification}>Got it</Button>
        </Tooltip>
      </Overlay>
      <Callers
        muted={muted}
        deafened={deafened}
        audioContext={audioContext}
        localStream={localStream}
        callersExpanded={callersExpanded}
        onToggleCallersExpanded={onToggleCallersExpanded}
        otherPeers={callState.otherPeers}
        peerStreams={callState.peerStreams}
      />
    </>
  );
};

export default CallSection;
