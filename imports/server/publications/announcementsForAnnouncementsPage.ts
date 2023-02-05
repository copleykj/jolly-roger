import { check } from 'meteor/check';
import Announcements from '../../lib/models/Announcements';
import type Hunts from '../../lib/models/Hunts';
import MeteorUsers from '../../lib/models/MeteorUsers';
import { makeForeignKeyMatcher } from '../../lib/models/Model';
import announcementsForAnnouncementsPage from '../../lib/publications/announcementsForAnnouncementsPage';
import publishJoinedQuery from '../publishJoinedQuery';
import definePublication from './definePublication';

definePublication(announcementsForAnnouncementsPage, {
  validate(arg) {
    check(arg, {
      huntId: makeForeignKeyMatcher<typeof Hunts>(),
    });
    return arg;
  },

  async run({ huntId }) {
    if (!this.userId) {
      return [];
    }

    const user = await MeteorUsers.findOneAsync(this.userId);
    if (!user?.hunts?.includes(huntId)) {
      return [];
    }

    publishJoinedQuery(this, {
      model: Announcements,
      foreignKeys: [{
        field: 'createdBy',
        join: {
          model: MeteorUsers,
          projection: { displayName: 1 },
        },
      }],
    }, { hunt: huntId });

    this.ready();
    return undefined;
  },
});
