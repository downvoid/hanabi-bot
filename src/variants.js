import * as https from 'https';
import { CLUE } from './constants.js';

/**
 * @typedef {import('./types.js').Clue} Clue
 * @typedef {import('./types.js').Identity} Identity
 * 
 * @typedef Variant
 * @property {number} id
 * @property {string} name
 * @property {string[]} suits
 * @property {string} newID
 * @property {number} [specialRank]
 * @property {boolean} [specialAllClueColours]
 * @property {boolean} [specialAllClueRanks]
 * @property {boolean} [specialNoClueColours]
 * @property {boolean} [specialNoClueRanks]
 * @property {number} criticalRank
 */

const variantsURL = 'https://raw.githubusercontent.com/Hanabi-Live/hanabi-live/main/packages/game/src/json/variants.json';
const colorsURL = 'https://raw.githubusercontent.com/Hanabi-Live/hanabi-live/main/packages/game/src/json/suits.json';

/** @type {Promise<Variant[]>} */
const variants_promise = new Promise((resolve, reject) => {
	https.get(variantsURL, (res) => {
		const { statusCode } = res;

		if (statusCode !== 200) {
			// Consume response data to free up memory
			res.resume();
			reject(`Failed to retrieve variants. Status Code: ${statusCode}`);
		}

		res.setEncoding('utf8');

		let rawData = '';
		res.on('data', (chunk) => { rawData += chunk; });
		res.on('end', () => {
			try {
				const parsedData = JSON.parse(rawData);
				resolve(parsedData);
			} catch (e) {
				reject(e.message);
			}
		});
	}).on('error', (e) => {
		console.error(`Error when retrieving variants: ${e.message}`);
	});
});

/** @type {Promise<Array>} */
const colors_promise = new Promise((resolve, reject) => {
	https.get(colorsURL, (res) => {
		const { statusCode } = res;

		if (statusCode !== 200) {
			// Consume response data to free up memory
			res.resume();
			reject(`Failed to retrieve colors. Status Code: ${statusCode}`);
		}

		res.setEncoding('utf8');

		let rawData = '';
		res.on('data', (chunk) => { rawData += chunk; });
		res.on('end', () => {
			try {
				const parsedData = JSON.parse(rawData);
				resolve(parsedData);
			} catch (e) {
				reject(e.message);
			}
		});
	}).on('error', (e) => {
		console.error(`Error when retrieving colors: ${e.message}`);
	});
});

/**
 * Returns a variant's properties, given its name.
 * @param {string} name
 */
export async function getVariant(name) {
	const variants = await variants_promise;
	return variants.find(variant => variant.name === name);
}

/*
export const shortForms = /** @type {const}  ({
	'Red': 'r',
	'Yellow': 'y',
	'Green': 'g',
	'Blue': 'b',
	'Purple': 'p',
	'Teal': 't',
	'Black': 'k',
	'Rainbow': 'm',
	'White': 'w',
	'Pink': 'i',
	'Brown': 'n',
	'Omni': 'o',
	'Null': 'u',
	// TODO: Custom names, please fix implementation later
	'Prism': 's',
	'Light Pink': 'l',
	'Dark Rainbow': 'dm',
	'Gray': 'dw',
	'Dark Pink': 'di',
	'Gray Pink': 'dl',
	'Dark Brown': 'dn',
	'Dark Omni': 'do',
	'Dark Null': 'du',
	'Dark Prism': 'ds',
});
*/

export let shortForms = /** @type {string[]} */ ([]);

/**
 * Edits shortForms to have the correct acryonyms.
 * @param {string[]} suits
 */
export async function getShortForms(suits) {
	const colors = await colors_promise;
	const abbreviations = [];
	for (const suitName of suits) {
		if (['Black', 'Pink', 'Brown'].includes(suitName)) {
			abbreviations.push(['k', 'i', 'n'][['Black', 'Pink', 'Brown'].indexOf(suitName)]);
		} else {
			const abbreviation = colors.find(color => color.name === suitName)?.abbreviation ?? suitName.charAt(0);
			if (abbreviations.includes(abbreviation.toLowerCase())) {
				for (const char of suitName) {
					if (!abbreviations.includes(char)) {
						abbreviations.push(char.toLowerCase());
						break;
					}
				}
			} else {
				abbreviations.push(abbreviation.toLowerCase());
			}
		}
	}
	shortForms = abbreviations;
}

/**
 * Returns whether the card would be touched by the clue.
 * @param {Identity} card
 * @param {string[]} suits
 * @param {Omit<Clue, 'target'>} clue
 */
export function cardTouched(card, suits, clue) {
	const { type, value } = clue;
	const { suitIndex, rank } = card;
	const suit = suits[suitIndex];

	if (suit === 'Null' || suit === 'Dark Null') {
		return false;
	}
	else if (suit === 'Omni' || suit === 'Dark Omni') {
		return true;
	}

	if (type === CLUE.COLOUR) {
		if (suit === 'White' || suit === 'Gray' || suit === 'Light Pink' || suit === 'Gray Pink') {
			return false;
		}
		else if (suit === 'Rainbow' || suit === 'Dark Rainbow' || suit === 'Muddy Rainbow' || suit === 'Cocoa Rainbow') {
			return true;
		}
		else if (suit === 'Prism' || suit === 'Dark Prism') {
			// Something about this implementation does not seem right.
			return (rank % suits.length - 1) === (value + 1);
		}

		return suitIndex === value;
	}
	else if (type === CLUE.RANK) {
		if (suit === 'Brown' || suit === 'Dark Brown' || suit === 'Muddy Rainbow' || suit === 'Cocoa Rainbow') {
			return false;
		}
		else if (suit === 'Pink' || suit === 'Dark Pink' || suit === 'Light Pink' || suit === 'Gray Pink') {
			return true;
		}

		return rank === value;
	}
}

/**
 * Returns whether the clue is possible to give. For example, white cannot be clued.
 * @param {string[]} suits
 * @param {Omit<Clue, 'target'>} clue
 */
export function isCluable(suits, clue) {
	const { type, value } = clue;

	if (type === CLUE.COLOUR && [
		'Null', 'Omni', 'White', 'Rainbow', 'Light Pink', 'Muddy Rainbow', 'Prism',
		'Dark Null', 'Dark Omni', 'Gray', 'Dark Rainbow', 'Gray Pink', 'Cocoa Rainbow', 'Dark Prism'
	].includes(suits[value])) {
		return false;
	}
	return true;
}

/**
 * Returns the total number of cards for an identity.
 * @param {string[]} suits
 * @param {Variant} variant
 * @param {Identity} identity
 */
export function cardCount(suits, variant, { suitIndex, rank }) {
	if ([
		'Dark Null', 'Dark Brown', 'Cocoa Rainbow',
		'Gray', 'Black', 'Dark Rainbow',
		'Gray Pink', 'Dark Pink', 'Dark Omni',
		'Dark Prism'
	].includes(suits[suitIndex])) {
		return 1;
	}

	if (variant.criticalRank === rank) {
		return 1;
	}

	return [3, 2, 2, 2, 1][rank - 1];
}
