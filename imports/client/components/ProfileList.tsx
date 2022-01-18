import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { faEraser } from '@fortawesome/free-solid-svg-icons/faEraser';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, {
  MouseEvent, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import FormControl, { FormControlProps } from 'react-bootstrap/FormControl';
import FormGroup from 'react-bootstrap/FormGroup';
import FormLabel from 'react-bootstrap/FormLabel';
import FormText from 'react-bootstrap/FormText';
import InputGroup from 'react-bootstrap/InputGroup';
import ListGroup from 'react-bootstrap/ListGroup';
import ListGroupItem from 'react-bootstrap/ListGroupItem';
import Modal from 'react-bootstrap/Modal';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { getAvatarCdnUrl } from '../../lib/discord';
import { userIdIsAdmin } from '../../lib/is-admin';
import { userIsOperatorForHunt } from '../../lib/permission_stubs';
import { ProfileType } from '../../lib/schemas/profile';

const ProfilesSummary = styled.div`
  text-align: right;
`;

const ListItemContainer = styled.div`
  width: 100%;

  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
`;

const ImageBlock = styled.div`
  width: 40px;
  height: 40px;
  flex: none;
  margin-right: .5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const OperatorBox = styled.div`
  margin-left: auto;
  padding-right: 0.5rem;
  * {
    margin: 0 0.25rem;
  }
`;

type OperatorModalHandle = {
  show(): void;
};

const PromoteOperatorModal = React.forwardRef((
  { profile, huntId }: { profile: ProfileType, huntId: string },
  forwardedRef: React.Ref<OperatorModalHandle>,
) => {
  const [visible, setVisible] = useState(true);
  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);
  useImperativeHandle(forwardedRef, () => ({ show }), [show]);

  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<Error>();
  const clearError = useCallback(() => setError(undefined), []);

  const promote = useCallback(() => {
    Meteor.call('makeOperatorForHunt', profile._id, huntId, (e: Meteor.Error) => {
      setDisabled(false);
      if (e) {
        setError(e);
      } else {
        hide();
      }
    });
    setDisabled(true);
  }, [huntId, hide, profile._id]);

  return (
    <Modal show={visible} onHide={hide}>
      <Modal.Header closeButton>
        <Modal.Title>Promote Operator</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to make
          {' '}
          <strong>{profile.displayName}</strong>
          {' '}
          an operator?
        </p>
        {error && (
          <Alert variant="danger" dismissible onClose={clearError}>
            {error.message}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={hide} disabled={disabled}>
          Cancel
        </Button>
        <Button variant="danger" onClick={promote} disabled={disabled}>
          Promote
        </Button>
      </Modal.Footer>
    </Modal>
  );
});

const DemoteOperatorModal = React.forwardRef((
  { profile, huntId }: { profile: ProfileType, huntId: string },
  forwardedRef: React.Ref<OperatorModalHandle>,
) => {
  const [visible, setVisible] = useState(true);
  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);
  useImperativeHandle(forwardedRef, () => ({ show }), [show]);

  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<Error>();
  const clearError = useCallback(() => setError(undefined), []);

  const demote = useCallback(() => {
    Meteor.call('demoteOperatorForHunt', profile._id, huntId, (e: Error) => {
      setDisabled(false);
      if (e) {
        setError(e);
      } else {
        hide();
      }
    });
    setDisabled(true);
  }, [huntId, hide, profile._id]);

  return (
    <Modal show={visible} onHide={hide}>
      <Modal.Header closeButton>
        <Modal.Title>Demote Operator</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to demote
          {' '}
          <strong>{profile.displayName}</strong>
          ?
        </p>
        {error && (
          <Alert variant="danger" dismissible onClose={clearError}>
            {error.message}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={hide} disabled={disabled}>
          Cancel
        </Button>
        <Button variant="danger" onClick={demote} disabled={disabled}>
          Demote
        </Button>
      </Modal.Footer>
    </Modal>
  );
});

const OperatorControls = ({ profile, huntId }: { profile: ProfileType, huntId: string }) => {
  const self = useTracker(() => profile._id === Meteor.userId(), [profile._id]);
  const { userIsOperator, userIsAdmin } = useTracker(() => {
    return {
      userIsOperator: userIsOperatorForHunt(profile._id, huntId),
      userIsAdmin: userIdIsAdmin(profile._id),
    };
  }, [profile._id, huntId]);

  const [renderPromoteModal, setRenderPromoteModal] = useState(false);
  const promoteModalRef = useRef<OperatorModalHandle>(null);
  const [renderDemoteModal, setRenderDemoteModal] = useState(false);
  const demoteModalRef = useRef<OperatorModalHandle>(null);

  const showPromoteModal = useCallback((e: MouseEvent) => {
    e.preventDefault();
    if (renderPromoteModal && promoteModalRef.current) {
      promoteModalRef.current.show();
    } else {
      setRenderPromoteModal(true);
    }
  }, [renderPromoteModal, promoteModalRef]);
  const showDemoteModal = useCallback((e: MouseEvent) => {
    e.preventDefault();
    if (renderDemoteModal && demoteModalRef.current) {
      demoteModalRef.current.show();
    } else {
      setRenderDemoteModal(true);
    }
  }, [renderDemoteModal]);

  const preventPropagation = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <OperatorBox onClick={preventPropagation}>
      {renderPromoteModal && (
        <PromoteOperatorModal ref={promoteModalRef} profile={profile} huntId={huntId} />
      )}
      {renderDemoteModal && (
        <DemoteOperatorModal ref={demoteModalRef} profile={profile} huntId={huntId} />
      )}
      {userIsAdmin && (
        <Badge variant="success">Admin</Badge>
      )}
      {userIsOperator ? (
        <>
          {!self && (
            <Button size="sm" variant="warning" onClick={showDemoteModal}>
              Demote
            </Button>
          )}
          <Badge variant="info">Operator</Badge>
        </>
      ) : (
        <Button size="sm" variant="warning" onClick={showPromoteModal}>
          Make operator
        </Button>
      )}
    </OperatorBox>
  );
};

const ProfileList = ({
  huntId, canInvite, canSyncDiscord, canMakeOperator, profiles, roles,
}: {
  huntId?: string;
  canInvite?: boolean;
  canSyncDiscord?: boolean;
  canMakeOperator?: boolean;
  profiles: ProfileType[];
  roles?: Record<string, string[]>;
}) => {
  const [searchString, setSearchString] = useState<string>('');

  const searchBarRef = useRef<HTMLInputElement>(null); // Wrong type but I should fix it

  const maybeStealCtrlF = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      const node = searchBarRef.current;
      if (node) {
        node.focus();
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', maybeStealCtrlF);
    return () => {
      window.removeEventListener('keydown', maybeStealCtrlF);
    };
  }, [maybeStealCtrlF]);

  // The type annotation on FormControl is wrong here - the event is from the
  // input element, not the FormControl React component
  const onSearchStringChange: FormControlProps['onChange'] = useCallback((e) => {
    setSearchString(e.currentTarget.value);
  }, []);

  const matcher = useMemo(() => {
    const searchKeys = searchString.split(' ');
    const toMatch = searchKeys.filter(Boolean).map((s) => s.toLowerCase());
    const isInteresting = (profile: ProfileType) => {
      for (let i = 0; i < toMatch.length; i++) {
        const searchKey = toMatch[i];
        if (profile.displayName.toLowerCase().indexOf(searchKey) === -1 &&
          profile.primaryEmail.toLowerCase().indexOf(searchKey) === -1 &&
          (!profile.phoneNumber || profile.phoneNumber.toLowerCase().indexOf(searchKey) === -1) &&
          (!profile.discordAccount || `${profile.discordAccount.username.toLowerCase()}#${profile.discordAccount.discriminator}`.indexOf(searchKey) === -1) &&
          (!roles?.[profile._id]?.some((role) => role.toLowerCase().indexOf(searchKey) !== -1))) {
          return false;
        }
      }

      return true;
    };

    return isInteresting;
  }, [searchString, roles]);

  const clearSearch = useCallback(() => {
    setSearchString('');
  }, []);

  const syncDiscord = useCallback(() => {
    Meteor.call('syncDiscordRole', huntId);
  }, [huntId]);

  const syncDiscordButton = useMemo(() => {
    if (!huntId || !canSyncDiscord) {
      return null;
    }

    return (
      <FormGroup>
        <Button variant="warning" onClick={syncDiscord}>
          Sync this hunt&apos;s Discord role
        </Button>
        <FormText>
          (Click this if people are reporting that they can&apos;t access hunt-specific channels)
        </FormText>
      </FormGroup>
    );
  }, [huntId, canSyncDiscord, syncDiscord]);

  const inviteToHuntItem = useMemo(() => {
    if (!huntId || !canInvite) {
      return null;
    }

    return (
      <ListGroupItem action as={Link} to={`/hunts/${huntId}/hunters/invite`} className="p-1">
        <ListItemContainer>
          <ImageBlock>
            <FontAwesomeIcon icon={faPlus} />
          </ImageBlock>
          <strong>Invite someone...</strong>
        </ListItemContainer>
      </ListGroupItem>
    );
  }, [huntId, canInvite]);

  const globalInfo = useMemo(() => {
    if (huntId) {
      return null;
    }

    return (
      <Alert variant="info">
        This shows everyone registered on Jolly Roger, not just those hunting in this year&apos;s
        Mystery Hunt. For that, go to the hunt page and click on &quot;Hunters&quot;.
      </Alert>
    );
  }, [huntId]);

  const matching = profiles.filter(matcher);
  return (
    <div>
      <h1>List of hunters</h1>
      <ProfilesSummary>
        Total hunters:
        {' '}
        {profiles.length}
      </ProfilesSummary>

      {syncDiscordButton}

      <FormGroup>
        <FormLabel htmlFor="jr-profile-list-search">
          Search
        </FormLabel>
        <InputGroup>
          <FormControl
            id="jr-profile-list-search"
            type="text"
            ref={searchBarRef}
            placeholder="search by name, email, phone, Discord..."
            value={searchString}
            onChange={onSearchStringChange}
          />
          <InputGroup.Append>
            <Button variant="secondary" onClick={clearSearch}>
              <FontAwesomeIcon icon={faEraser} />
            </Button>
          </InputGroup.Append>
        </InputGroup>
      </FormGroup>

      {globalInfo}

      <ListGroup>
        {inviteToHuntItem}
        {matching.map((profile) => {
          const name = profile.displayName || '<no name provided>';
          const discordAvatarUrl = getAvatarCdnUrl(profile.discordAccount);
          return (
            <ListGroupItem key={profile._id} action as={Link} to={`/users/${profile._id}`} className="p-1">
              <ListItemContainer>
                <ImageBlock>
                  {discordAvatarUrl && (
                    <img
                      alt={`${name}'s Discord avatar`}
                      src={discordAvatarUrl}
                      width={40}
                      height={40}
                      className="discord-avatar"
                    />
                  )}
                </ImageBlock>
                {name}
                {huntId && canMakeOperator && (
                  <OperatorControls huntId={huntId} profile={profile} />
                )}
              </ListItemContainer>
            </ListGroupItem>
          );
        })}
      </ListGroup>
    </div>
  );
};

export default ProfileList;
