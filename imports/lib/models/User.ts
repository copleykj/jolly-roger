import { z } from 'zod';
import { GLOBAL_SCOPE } from '../isAdmin';
import type { DiscordAccountType } from './DiscordAccount';
import DiscordAccount from './DiscordAccount';
import type { HuntId } from './Hunts';
import { foreignKey, nonEmptyString, stringId } from './customTypes';
import validateSchema from './validateSchema';

declare module 'meteor/meteor' {
  namespace Meteor {
    interface User {
      lastLogin?: Date;
      hunts?: HuntId[];
      roles?: Partial<Record<
        HuntId | typeof GLOBAL_SCOPE,
        string[]
      >>; // scope -> roles
      displayName?: string;
      googleAccount?: string;
      googleAccountId?: string;
      discordAccount?: DiscordAccountType;
      phoneNumber?: string;
      dingwords?: string[];
    }
  }
}

// Note: this needs to exactly match the type of Meteor.User, otherwise we will
// fail typechecking when we use our attachSchema function. Also, because
// Meteor.users isn't a Model, we can't rely on transforms or defaults in this
// schema.
export const User = z.object({
  _id: stringId,
  username: z.string().regex(/^[a-z0-9A-Z_]{3,15}$/).optional(),
  emails: z.object({ address: z.string().email(), verified: z.boolean() }).array().optional(),
  createdAt: z.date().optional(),
  lastLogin: z.date().optional(),
  services: z.any().optional(),
  profile: z.object({}).optional(),
  roles: z.record(
    z.union([
      z.string().brand('jr_hunts'),
      z.literal(GLOBAL_SCOPE),
    ]),
    nonEmptyString.array()
  ).optional(),
  hunts: foreignKey.brand('jr_hunts').array().optional(),
  displayName: nonEmptyString.optional(),
  googleAccount: nonEmptyString.optional(),
  googleAccountId: nonEmptyString.optional(),
  discordAccount: DiscordAccount.optional(),
  phoneNumber: nonEmptyString.optional(),
  dingwords: nonEmptyString.array().optional(),
});
validateSchema(User);

export type ProfileFields = 'displayName' | 'googleAccount' | 'discordAccount' | 'phoneNumber' | 'dingwords';

export default User;
