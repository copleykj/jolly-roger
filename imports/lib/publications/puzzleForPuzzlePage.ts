import type { HuntId } from '../models/Hunts';
import TypedPublication from './TypedPublication';

export default new TypedPublication<{ puzzleId: string, huntId: HuntId }>(
  'Puzzles.publications.forPuzzlePage'
);
