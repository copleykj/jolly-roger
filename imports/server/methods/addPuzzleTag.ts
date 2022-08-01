import { check } from 'meteor/check';
import Ansible from '../../Ansible';
import Puzzles from '../../lib/models/Puzzles';
import addPuzzleTag from '../../methods/addPuzzleTag';
import getOrCreateTagByName from '../getOrCreateTagByName';

addPuzzleTag.define({
  validate(arg) {
    check(arg, {
      puzzleId: String,
      tagName: String,
    });

    return arg;
  },

  run({ puzzleId, tagName }) {
    check(this.userId, String);

    // Look up which hunt the specified puzzle is from.
    const hunt = Puzzles.findOne({
      _id: puzzleId,
    }, {
      fields: {
        hunt: 1,
      },
    });
    const huntId = hunt && hunt.hunt;
    if (!huntId) throw new Error(`No puzzle known with id ${puzzleId}`);
    const tagId = getOrCreateTagByName(huntId, tagName)._id;

    Ansible.log('Tagging puzzle', { puzzle: puzzleId, tag: tagName });
    Puzzles.update({
      _id: puzzleId,
    }, {
      $addToSet: {
        tags: tagId,
      },
    });
  },
});