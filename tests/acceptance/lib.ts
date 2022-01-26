/* eslint-disable import/prefer-default-export */
/* eslint-disable no-console */
import { Accounts } from 'meteor/accounts-base';
import { check } from 'meteor/check';
import { DDP } from 'meteor/ddp';
import { Meteor } from 'meteor/meteor';
import { Migrations } from 'meteor/percolate:migrations';
import { Tracker } from 'meteor/tracker';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import { addUserToRole } from '../../imports/lib/permission_stubs';

export const USER_EMAIL = 'jolly-roger@deathandmayhem.com';
export const USER_PASSWORD = 'password';

if (Meteor.isServer) {
  Meteor.methods({
    'test.resetDatabase': function () {
      if (!Meteor.isAppTest) {
        throw new Meteor.Error(500, 'This code must not run in production');
      }

      resetDatabase();
      Migrations.config({ log: false, logger: () => {} });
      Migrations.migrateTo('latest');
      console.log('Reset database');
    },

    'test.authentication.createUser': function () {
      if (!Meteor.isAppTest) {
        throw new Meteor.Error(500, 'This code must not run in production');
      }

      Accounts.createUser({
        email: USER_EMAIL,
        password: USER_PASSWORD,
      });
      console.log('Created test user', { email: USER_EMAIL });
    },

    'test.authentication.addRole': function (scope, role) {
      if (!Meteor.isAppTest) {
        throw new Meteor.Error(500, 'This code must not run in production');
      }

      check(this.userId, String);
      check(scope, String);
      check(role, String);
      addUserToRole(this.userId, scope, role);
    },
  });
}

// waitForSubscriptions and afterFlush both taken from
// https://guide.meteor.com/testing.html#full-app-integration-test

const waitForSubscriptions = () => new Promise<void>((resolve) => {
  const poll = Meteor.setInterval(() => {
    // eslint-disable-next-line no-underscore-dangle
    if (DDP._allSubscriptionsReady()) {
      Meteor.clearInterval(poll);
      resolve();
    }
  }, 200);
});

const afterFlush = () => new Promise<void>((resolve) => {
  Tracker.afterFlush(resolve);
});

export const stabilize = async () => {
  await waitForSubscriptions();
  await afterFlush();
};
