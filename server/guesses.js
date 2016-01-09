Meteor.methods({
  addGuessForPuzzle(puzzleId, guess) {
    check(this.userId, String);
    check(puzzleId, String);
    check(guess, String);
    let puzzle = Models.Puzzles.findOne({
      _id: puzzleId,
    });

    Models.Guesses.insert({
      hunt: puzzle.hunt,
      puzzle: puzzleId,
      guess: guess,
      state: 'pending',
    });
  },

  markGuessCorrect(guessId) {
    Roles.checkPermission(this.userId, 'mongo.guesses.update');
    Models.Guesses.update({
      _id: guessId,
    }, {
      $set: {
        state: 'correct',
      },
    });
  },

  markGuessIncorrect(guessId) {
    Roles.checkPermission(this.userId, 'mongo.guesses.update');
    Models.Guesses.update({
      _id: guessId,
    }, {
      $set: {
        state: 'incorrect',
      },
    });
  },

  markGuessRejected(guessId) {
    Roles.checkPermission(this.userId, 'mongo.guesses.update');
    Models.Guesses.update({
      _id: guessId,
    }, {
      $set: {
        state: 'rejected',
      },
    });
  },
});