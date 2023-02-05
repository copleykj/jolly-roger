import { z } from 'zod';
import type { ModelType } from './Model';
import SoftDeletedModel from './SoftDeletedModel';
import { foreignKey, nonEmptyString } from './customTypes';
import withCommon from './withCommon';

// A broadcast message from a hunt operator to be displayed
// to all participants in the specified hunt.
const Announcement = withCommon(z.object({
  hunt: foreignKey.brand('jr_hunts'),
  message: nonEmptyString,
}));

const Announcements = new SoftDeletedModel('jr_announcements', Announcement);
Announcements.addIndex({ deleted: 1, hunt: 1, createdAt: -1 });
export type AnnouncementType = ModelType<typeof Announcements>;

export default Announcements;
