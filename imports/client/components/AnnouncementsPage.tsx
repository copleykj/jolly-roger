import { Meteor } from 'meteor/meteor';
import { useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { calendarTimeFormat } from '../../lib/calendarTimeFormat';
import Announcements from '../../lib/models/announcements';
import Profiles from '../../lib/models/profiles';
import { userMayAddAnnouncementToHunt } from '../../lib/permission_stubs';
import { AnnouncementType } from '../../lib/schemas/announcement';
import { useBreadcrumb } from '../hooks/breadcrumb';
import useSubscribeDisplayNames from '../hooks/use-subscribe-display-names';
import markdown from '../markdown';

/* eslint-disable max-len */

interface AnnouncementFormProps {
  huntId: string;
}

enum AnnouncementFormSubmitState {
  IDLE = 'idle',
  SUBMITTING = 'submitting',
  FAILED = 'failed',
}

const AnnouncementFormContainer = styled.div`
  background-color: #f0f0f0;
  padding: 16px;

  h3 {
    margin-top: 0px;
  }

  textarea {
    width: 100%;
  }

  .button-row {
    display: flex;
    flex-direction: row-reverse;
    align-items: flex-start;
    justify-content: flex-start;
  }
`;

const AnnouncementForm = (props: AnnouncementFormProps) => {
  const [message, setMessage] = useState<string>('');
  const [submitState, setSubmitState] = useState<AnnouncementFormSubmitState>(AnnouncementFormSubmitState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const onMessageChanged = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  }, []);

  const postAnnouncement = useCallback(() => {
    if (message) {
      setSubmitState(AnnouncementFormSubmitState.SUBMITTING);
      Meteor.call('postAnnouncement', props.huntId, message, (error?: Error) => {
        if (error) {
          setErrorMessage(error.message);
          setSubmitState(AnnouncementFormSubmitState.FAILED);
        } else {
          setErrorMessage('');
          setSubmitState(AnnouncementFormSubmitState.IDLE);
        }
      });
    }
  }, [message, props.huntId]);

  return (
    <AnnouncementFormContainer>
      <h3>Write an announcement:</h3>
      {submitState === 'failed' ? <Alert variant="danger">{errorMessage}</Alert> : null}
      <textarea
        value={message}
        onChange={onMessageChanged}
        disabled={submitState === 'submitting'}
      />
      <div>Try to keep it brief and on-point.</div>
      <div className="button-row">
        <Button
          variant="primary"
          onClick={postAnnouncement}
          disabled={submitState === 'submitting'}
        >
          Send
        </Button>
      </div>
    </AnnouncementFormContainer>
  );
};

interface AnnouncementProps {
  announcement: AnnouncementType;
  displayName: string;
}

const AnnouncementContainer = styled.div`
  margin-top: 8px;
  margin-bottom: 8px;
  padding: 8px;
  background-color: #eee;
`;

const AnnouncementOrigin = styled.div`
  text-align: right;
`;

const AnnouncementTimestamp = styled.div`
  text-align: right;
`;

const Announcement = (props: AnnouncementProps) => {
  const ann = props.announcement;

  // TODO: All the styles here could stand to be improved, but this gets it on the screen in a
  // minimally-offensive manner, and preserves the intent of newlines.
  return (
    <AnnouncementContainer>
      <AnnouncementOrigin>
        <AnnouncementTimestamp>{calendarTimeFormat(ann.createdAt)}</AnnouncementTimestamp>
        <div>{props.displayName}</div>
      </AnnouncementOrigin>
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: markdown(ann.message) }}
      />
    </AnnouncementContainer>
  );
};

const AnnouncementsPage = () => {
  const huntId = useParams<'huntId'>().huntId!;
  useBreadcrumb({ title: 'Announcements', path: `/hunts/${huntId}/announcements` });

  // We already have subscribed to mongo.announcements on the main page, since we want to be able
  // to show them on any page.  So we don't *need* to make the subscription here...
  // ...except that we might want to wait to render until we've received all of them?  IDK.
  const announcementsLoading = useSubscribe('mongo.announcements', { hunt: huntId });
  const displayNamesLoading = useSubscribeDisplayNames();
  const loading = announcementsLoading() || displayNamesLoading();

  const announcements = useTracker(() => (
    loading ? [] : Announcements.find({ hunt: huntId }, { sort: { createdAt: 1 } }).fetch()
  ), [loading, huntId]);
  const displayNames = useTracker(() => (loading ? {} : Profiles.displayNames()), [loading]);
  const canCreateAnnouncements = useTracker(() => userMayAddAnnouncementToHunt(Meteor.userId(), huntId), [huntId]);

  if (loading) {
    return <div>loading...</div>;
  }

  return (
    <div>
      <h1>Announcements</h1>
      {canCreateAnnouncements && <AnnouncementForm huntId={huntId} />}
      {/* ostensibly these should be ul and li, but then I have to deal with overriding
          block/inline and default margins and list style type and meh */}
      <div>
        {announcements.map((announcement) => {
          return (
            <Announcement
              key={announcement._id}
              announcement={announcement}
              displayName={displayNames[announcement.createdBy]}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AnnouncementsPage;
