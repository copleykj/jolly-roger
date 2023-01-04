import { check, Match } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import { ServiceConfiguration } from 'meteor/service-configuration';
import Ansible from '../../Ansible';
import MeteorUsers from '../../lib/models/MeteorUsers';
import { userMayConfigureGoogleOAuth } from '../../lib/permission_stubs';
import configureGoogleOAuthClient from '../../methods/configureGoogleOAuthClient';

configureGoogleOAuthClient.define({
  validate(arg) {
    check(arg, {
      clientId: Match.Optional(String),
      secret: Match.Optional(String),
    });
    return arg;
  },

  async run({ clientId, secret }) {
    check(this.userId, String);

    if (!!clientId !== !!secret) {
      throw new Meteor.Error(400, 'Must provide either both client ID and secret or neither');
    }

    if (!userMayConfigureGoogleOAuth(await MeteorUsers.findOneAsync(this.userId))) {
      throw new Meteor.Error(401, 'Must be admin to configure Google OAuth');
    }

    Ansible.log('Configuring google oauth client', {
      clientId,
      user: this.userId,
    });

    if (clientId) {
      await ServiceConfiguration.configurations.upsertAsync({ service: 'google' }, {
        $set: {
          clientId,
          secret,
          loginStyle: 'popup',
        },
      });
    } else {
      await ServiceConfiguration.configurations.removeAsync({ service: 'google' });
    }
  },
});
