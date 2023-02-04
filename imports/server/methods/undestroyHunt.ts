import { check } from 'meteor/check';
import Hunts from '../../lib/models/Hunts';
import MeteorUsers from '../../lib/models/MeteorUsers';
import { makeForeignKeyMatcher } from '../../lib/models/Model';
import { checkAdmin } from '../../lib/permission_stubs';
import undestroyHunt from '../../methods/undestroyHunt';
import defineMethod from './defineMethod';

defineMethod(undestroyHunt, {
  validate(arg) {
    check(arg, {
      huntId: makeForeignKeyMatcher<typeof Hunts>(),
    });
    return arg;
  },

  async run({ huntId }) {
    check(this.userId, String);
    checkAdmin(await MeteorUsers.findOneAsync(this.userId));

    await Hunts.undestroyAsync(huntId);
  },
});
