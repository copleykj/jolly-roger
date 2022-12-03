import { check, Match } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import { Promise as MeteorPromise } from 'meteor/promise';
import Ansible from '../Ansible';
import Flags from '../Flags';
import MeteorUsers from '../lib/models/MeteorUsers';
import Servers from '../lib/models/Servers';
import CallHistories from '../lib/models/mediasoup/CallHistories';
import ConnectAcks from '../lib/models/mediasoup/ConnectAcks';
import ConnectRequests from '../lib/models/mediasoup/ConnectRequests';
import ConsumerAcks from '../lib/models/mediasoup/ConsumerAcks';
import Consumers from '../lib/models/mediasoup/Consumers';
import Peers from '../lib/models/mediasoup/Peers';
import ProducerClients from '../lib/models/mediasoup/ProducerClients';
import ProducerServers from '../lib/models/mediasoup/ProducerServers';
import Rooms from '../lib/models/mediasoup/Rooms';
import Routers from '../lib/models/mediasoup/Routers';
import TransportRequests from '../lib/models/mediasoup/TransportRequests';
import TransportStates from '../lib/models/mediasoup/TransportStates';
import Transports from '../lib/models/mediasoup/Transports';
import { checkAdmin, userMayJoinCallsForHunt } from '../lib/permission_stubs';
import { registerPeriodicCleanupHook, serverId } from './garbage-collection';
import ignoringDuplicateKeyErrors from './ignoringDuplicateKeyErrors';
import Locks from './models/Locks';

registerPeriodicCleanupHook(async (deadServers) => {
  Peers.remove({ createdServer: { $in: deadServers } });

  // Deleting a room creates a potential inconsistency, since we might still
  // have peers on other servers. Therefore, take out a lock to make sure we
  // see a consistent view (and everyone else does too), then check if there
  // are still peers joined to this room
  await Rooms.find({ routedServer: { $in: deadServers } }).fetch().reduce(async (p, room) => {
    await p;
    await Locks.withLock(`mediasoup:room:${room.call}`, async () => {
      const removed = !!await Rooms.removeAsync(room._id);
      if (!removed) {
        return;
      }

      const peer = await Peers.findOneAsync({ call: room.call });
      if (peer) {
        await ignoringDuplicateKeyErrors(async () => {
          await Rooms.insertAsync({
            hunt: room.hunt,
            call: room.call,
            routedServer: serverId,
            createdBy: peer.createdBy,
          });
        });
      }
    });
  }, Promise.resolve());
});

Meteor.publish('mediasoup:debug', function () {
  if (!this.userId) {
    throw new Meteor.Error(401, 'Not logged in');
  }

  checkAdmin(this.userId);

  return [
    MeteorUsers.find({}, { fields: { displayName: 1, discordAccount: 1 } }),
    Servers.find(),
    CallHistories.find(),
    Peers.find(),
    Rooms.find(),
    Routers.find(),
    TransportRequests.find(),
    Transports.find(),
    TransportStates.find(),
    ConnectRequests.find(),
    ConnectAcks.find(),
    ProducerClients.find(),
    ProducerServers.find(),
    Consumers.find(),
    ConsumerAcks.find(),
  ];
});

Meteor.publish('mediasoup:metadata', function (hunt, call) {
  check(hunt, String);
  check(call, String);

  if (!this.userId) {
    throw new Meteor.Error(401, 'Not logged in');
  }

  if (!userMayJoinCallsForHunt(this.userId, hunt)) {
    throw new Meteor.Error(403, 'Not a member of this hunt');
  }

  return [
    Peers.find({ hunt, call }),
    CallHistories.find({ hunt, call }),
  ];
});

Meteor.publish('mediasoup:join', function (hunt, call, tab) {
  check(hunt, String);
  check(call, String);
  check(tab, String);

  if (!this.userId) {
    throw new Meteor.Error(401, 'Not logged in');
  }

  if (!userMayJoinCallsForHunt(this.userId, hunt)) {
    throw new Meteor.Error(403, 'Not a member of this hunt');
  }

  if (Flags.active('disable.webrtc')) {
    throw new Meteor.Error(403, 'WebRTC disabled');
  }

  let peerId: string;
  MeteorPromise.await(Locks.withLock(`mediasoup:room:${call}`, async () => {
    if (!await Rooms.findOneAsync({ call })) {
      await Rooms.insertAsync({
        hunt,
        call,
        routedServer: serverId,
      });
    }

    // Before trying to join the room, remove any existing peer record from the
    // same tab.
    //
    // This shouldn't happen most of the time, but can happen if the server
    // crashes or the client gets disconnected and reconnects (possibly to a
    // different server) before the server that served the client's previous
    // session notices.
    //
    // In the event we see such a record in the DB, we can safely remove it. Since
    // the tabId alone should not get reissued by different clients, we can be
    // sure that the client no longer trusts that the previous `call.join` is
    // active, and we can just take this as a signal to hasten that cleanup.
    // If the room is not yet created, create it.
    const maybeOldPeer = await Peers.findOneAsync({ hunt, call, tab });
    if (maybeOldPeer) {
      Ansible.log('Removing peer with same hunt/call/tab', { peer: maybeOldPeer._id });
      await Peers.removeAsync({
        _id: maybeOldPeer._id, hunt, call, tab,
      });
    }

    const peerCount = await Peers.find({ hunt, call }).countAsync();
    // If we are a new joiner and would be the 8th (or more) peer, join the
    // call starting out muted, because large calls can get noisy.
    // In local development, make this just 3 because it's annoying to open that many browser tabs.
    const crowdSize = Meteor.isDevelopment ? 3 : 8;
    let initialPeerState: 'active' | 'muted' | 'deafened' = peerCount + 1 >= crowdSize ? 'muted' : 'active';
    // But if we were previously in call, just restore whatever the previous
    // mute state was.
    if (maybeOldPeer) {
      let oldPeerState;
      if (maybeOldPeer.deafened) {
        oldPeerState = 'deafened' as const;
      } else if (maybeOldPeer.muted) {
        oldPeerState = 'muted' as const;
      } else {
        oldPeerState = 'active' as const;
      }
      initialPeerState = oldPeerState;
    }

    peerId = await Peers.insertAsync({
      createdServer: serverId,
      hunt,
      call,
      tab,
      initialPeerState,
      muted: initialPeerState !== 'active',
      deafened: initialPeerState === 'deafened',
    });

    Ansible.log('Peer joined call', {
      peer: peerId,
      call,
      createdBy: this.userId,
      state: initialPeerState,
    });
  }));

  this.onStop(() => {
    MeteorPromise.await(Locks.withLock(`mediasoup:room:${call}`, async () => {
      await Peers.removeAsync(peerId);

      // If the room is empty, remove it.
      if (!await Peers.findOneAsync({ call })) {
        await Rooms.removeAsync({ call });
      }
    }));
  });

  return [
    Rooms.find({ call }),
    Routers.find({ call }),
    Peers.find({ call }),
  ];
});

Meteor.publish('mediasoup:transports', function (peerId, rtpCapabilities) {
  check(peerId, String);
  check(rtpCapabilities, String);

  if (!this.userId) {
    throw new Meteor.Error(401, 'Not logged in');
  }

  if (Flags.active('disable.webrtc')) {
    throw new Meteor.Error(403, 'WebRTC disabled');
  }

  const peer = Peers.findOne(peerId);
  if (!peer) {
    throw new Meteor.Error(404, 'Peer not found');
  }

  const router = Routers.findOne({ call: peer.call });
  if (!router) {
    throw new Meteor.Error(404, 'Router not found');
  }

  if (peer.createdBy !== this.userId) {
    throw new Meteor.Error(403, 'Not allowed');
  }

  const transportRequest = TransportRequests.insert({
    createdServer: serverId,
    routedServer: router.createdServer,
    call: peer.call,
    peer: peer._id,
    rtpCapabilities,
  });

  this.onStop(() => {
    TransportRequests.remove(transportRequest);
    ConnectRequests.remove({ transportRequest });
    ConnectAcks.remove({ transportRequest });
    ConsumerAcks.remove({ transportRequest });
  });

  return [
    TransportRequests.find(transportRequest),
    Transports.find({ transportRequest }),
    ConnectRequests.find({ transportRequest }),
    ConnectAcks.find({ transportRequest }),
    Consumers.find({ transportRequest }),
    ConsumerAcks.find({ transportRequest }),
  ];
});

Meteor.publish('mediasoup:producer', function (transportId, trackId, kind, rtpParameters, paused) {
  check(transportId, String);
  check(trackId, String);
  check(kind, Match.OneOf('audio', 'video'));
  check(rtpParameters, String);
  check(paused, Boolean);

  if (!this.userId) {
    throw new Meteor.Error(401, 'Not logged in');
  }

  if (Flags.active('disable.webrtc')) {
    throw new Meteor.Error(403, 'WebRTC disabled');
  }

  const transport = Transports.findOne(transportId);
  if (!transport) {
    throw new Meteor.Error(404, 'Transport not found');
  }

  if (transport.createdBy !== this.userId) {
    throw new Meteor.Error(403, 'Not allowed');
  }

  const producerClientId = ProducerClients.insert({
    createdServer: serverId,
    routedServer: transport.createdServer,
    call: transport.call,
    peer: transport.peer,
    transport: transport._id,
    transportRequest: transport.transportRequest,
    trackId,
    kind,
    rtpParameters,
    paused,
  });

  this.onStop(() => {
    ProducerClients.remove(producerClientId);
  });

  return [
    ProducerClients.find(producerClientId),
    ProducerServers.find({ producerClient: producerClientId }),
  ];
});
