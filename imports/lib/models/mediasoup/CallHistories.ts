import { z } from 'zod';
import type { ModelType } from '../Model';
import Model from '../Model';
import { foreignKey } from '../customTypes';

// Don't use the BaseCodec here - unlike most database objects, this isn't
// manipulated by users, so many of the fields don't make sense
const CallHistory = z.object({
  hunt: foreignKey.brand('jr_hunts'),
  call: foreignKey,
  lastActivity: z.date(),
});

const CallHistories = new Model('jr_mediasoup_call_histories', CallHistory);
CallHistories.addIndex({ call: 1 }, { unique: true });
CallHistories.addIndex({ hunt: 1 });
export type CallHistoryType = ModelType<typeof CallHistories>;

export default CallHistories;
