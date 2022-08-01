import { check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import { ServiceConfiguration } from 'meteor/service-configuration';
import Ansible from '../../Ansible';
import { API_BASE } from '../../lib/discord';
import { userMayConfigureDiscordOAuth } from '../../lib/permission_stubs';
import configureDiscordOAuthClient from '../../methods/configureDiscordOAuthClient';

configureDiscordOAuthClient.define({
  validate(arg) {
    check(arg, {
      clientId: String,
      clientSecret: String,
    });
    return arg;
  },

  async run({ clientId, clientSecret }) {
    check(this.userId, String);

    if (!userMayConfigureDiscordOAuth(this.userId)) {
      throw new Meteor.Error(401, 'Must be admin to configure Discord OAuth');
    }

    if (!clientId && !clientSecret) {
      Ansible.log('Disabling discord oauth client', {
        user: this.userId,
      });
      ServiceConfiguration.configurations.remove({ service: 'discord' });
      return;
    }

    Ansible.log('Configuring discord oauth client', {
      clientId,
      user: this.userId,
    });

    // Test the client id/secret.
    const resp = await fetch(`${API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'identify',
      }),
    });

    if (resp.ok) {
      ServiceConfiguration.configurations.upsert({ service: 'discord' }, {
        $set: {
          appId: clientId,
          secret: clientSecret,
          loginStyle: 'popup',
        },
      });
    } else {
      const text = await resp.text();
      throw new Meteor.Error(`Discord credential test failed: ${text}`);
    }
  },
});