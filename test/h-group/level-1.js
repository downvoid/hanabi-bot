import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ACTION, CLUE } from '../../src/constants.js';
import { COLOUR, PLAYER, assertCardHasInferences, expandShortCard, setup, takeTurn } from '../test-utils.js';
import HGroup from '../../src/conventions/h-group.js';
import { take_action } from '../../src/conventions/h-group/take-action.js';
import * as Utils from '../../src/tools/util.js';

import logger from '../../src/tools/logger.js';

logger.setLevel(logger.LEVELS.ERROR);

describe('save clue', () => {
	it('prefers play over save with >1 clues', () => {
		const state = setup(HGroup, [
			['xx', 'xx', 'xx', 'xx', 'xx'],
			['g2', 'b1', 'r2', 'r3', 'g5'],
			['g3', 'p1', 'b3', 'b2', 'b5']
		], {
			level: 1,
			play_stacks: [1, 5, 1, 0, 5],
			clue_tokens: 2
		});

		// Bob's last 3 cards are clued.
		[2,3,4].forEach(index => state.hands[PLAYER.BOB][index].clued = true);

		// Cathy's last 2 cards are clued.
		[3,4].forEach(index => state.hands[PLAYER.CATHY][index].clued = true);

		const action = take_action(state);

		// Alice should give green to Cathy to finesse over save
		assert.deepEqual(Utils.objPick(action, ['type', 'target', 'value']), { type: ACTION.COLOUR, target: PLAYER.CATHY, value: COLOUR.GREEN });
	});

	it('prefers touching less cards to save critical cards', () => {
		const state = setup(HGroup, [
			['xx', 'xx', 'xx', 'xx', 'xx'],
			['b4', 'g5', 'p2', 'p4', 'g4']
		], {
			level: 1,
			discarded: ['g4']
		});

		// Bob's p2 is clued.
		state.hands[PLAYER.BOB][2].clued = true;

		const action = take_action(state);

		// Alice should give green to Bob instead of 4
		assert.deepEqual(Utils.objPick(action, ['type', 'target', 'value']), { type: ACTION.COLOUR, target: PLAYER.BOB, value: COLOUR.GREEN });
	});

	it('generates correct inferences for a 2 Save', () => {
		const state = setup(HGroup, [
			['xx', 'xx', 'xx', 'xx'],
			['r5', 'r4', 'b2', 'y4'],
			['g5', 'b2', 'g2', 'y2'],
			['y3', 'g2', 'y1', 'b3']
		], {
			level: 1,
			starting: PLAYER.BOB
		});

		// Bob clues 2 to Cathy.
		takeTurn(state, { type: 'clue', clue: { type: CLUE.RANK, value: 2 }, list: [8,9,10], target: PLAYER.CATHY, giver: PLAYER.BOB });

		// g2 is visible in Donald's hand. Other than that, the saved 2 can be any 2.
		assertCardHasInferences(state.hands[PLAYER.CATHY][3], ['r2', 'y2', 'b2', 'p2']);
	});

	it('does not finesse from a 2 Save', () => {
		const state = setup(HGroup, [
			['xx', 'xx', 'xx', 'xx', 'xx'],
			['r5', 'r4', 'r2', 'y4', 'y2'],
			['g5', 'b4', 'g1', 'y2', 'b3']
		], {
			level: 1,
			starting: PLAYER.CATHY
		});

		// Cathy clues 2 to Bob.
		takeTurn(state, { type: 'clue', clue: { type: CLUE.RANK, value: 2 }, list: [5,7], target: PLAYER.BOB, giver: PLAYER.CATHY });

		// Our slot 1 should not only be y1.
		assert.equal(state.hands[PLAYER.ALICE][0].inferred.length > 1, true);
		assert.equal(state.hands[PLAYER.ALICE][0].finessed, false);
	});
});

describe('early game', () => {
	it('will not 5 stall on a trash 5', () => {
		const state = setup(HGroup, [
			['xx', 'xx', 'xx', 'xx', 'xx'],
			['g4', 'r5', 'r4', 'y4', 'b3'],
		], {
			level: 1,
			discarded: ['r4', 'r4'],
			clue_tokens: 7
		});

		const action = state.take_action(state);
		assert.deepEqual(Utils.objPick(action, ['type', 'target']), { type: ACTION.DISCARD, target: 0 });
	});
});

describe('sacrifice discards', () => {
	it('discards a non-critical card when locked with no clues', () => {
		const state = setup(HGroup, [
			['xx', 'xx', 'xx', 'xx', 'xx'],
			['g4', 'r2', 'r4', 'p4', 'b3'],
			['r3', 'b4', 'r2', 'y4', 'y2'],
		], {
			level: 1,
			discarded: ['r4'],
			starting: PLAYER.BOB
		});

		// Bob clues Alice 5, touching slots 1, 3 and 5.
		takeTurn(state, { type: 'clue', clue: { type: CLUE.RANK, value: 5 }, list: [0,2,4], target: PLAYER.ALICE, giver: PLAYER.BOB });

		// Cathy clues Alice 4, touching slots 2 and 4.
		takeTurn(state, { type: 'clue', clue: { type: CLUE.RANK, value: 4 }, list: [1,3], target: PLAYER.ALICE, giver: PLAYER.CATHY });

		// Alice should discard slot 2.
		assert.equal(state.hands[PLAYER.ALICE].locked_discard().order, 3);
	});

	it('discards the farthest critical card when locked with crits', () => {
		const state = setup(HGroup, [
			['r4', 'b4', 'r5', 'b2', 'y5'],
		], {
			level: 1,
			play_stacks: [2, 1, 0, 0, 0],
			discarded: ['r4', 'b2', 'b4']
		});

		// Alice knows all of her cards (all crit).
		['r4', 'b4', 'r5', 'b2', 'y5'].forEach((short, index) => {
			state.hands[PLAYER.ALICE][index].intersect('inferred', [expandShortCard(short)]);
		});

		// Alice should discard y5.
		assert.equal(state.hands[PLAYER.ALICE].locked_discard().order, 0);
	});
});
