import { _ } from 'meteor/underscore';
import PendingAnnouncementsSchema from '../schemas/pending_announcements.js';
import Base from './base.js';

const PendingAnnouncements = new Base('pending_announcements');
PendingAnnouncements.attachSchema(PendingAnnouncementsSchema);
PendingAnnouncements.publish(function (q) {
  // It's sufficient to use the user property for filtering here; we
  // don't need to pay attention to the hunt ID
  return _.extend({}, q, { user: this.userId });
});

// Users can delete their own notifications
Roles.loggedInRole.allow('mongo.pending_announcements.remove', (uid, doc) => {
  return doc.user === uid;
});

export default PendingAnnouncements;