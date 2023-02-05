import { z } from 'zod';
import type { ModelType } from './Model';
import SoftDeletedModel from './SoftDeletedModel';
import { foreignKey } from './customTypes';
import withCommon from './withCommon';

// Broadcast announcements that have not yet been viewed by a given
// user
const PendingAnnouncement = withCommon(z.object({
  hunt: foreignKey.brand('jr_hunts'),
  announcement: foreignKey,
  user: foreignKey,
}));

const PendingAnnouncements = new SoftDeletedModel('jr_pending_announcements', PendingAnnouncement);
PendingAnnouncements.addIndex({ user: 1 });
export type PendingAnnouncementType = ModelType<typeof PendingAnnouncements>;

export default PendingAnnouncements;
