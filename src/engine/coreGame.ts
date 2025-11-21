import {
    isLegalRaise,
    isReverseOf,
    resolveBluff as resolveBluffCore,
} from './mexican';

export type CoreGameState = {
	player1Score: number;
	player2Score: number;
	currentPlayer: 'player1' | 'player2';
	currentRoll: string | null;
	currentClaim: string | null;
	baselineClaim: string | null;
	lastAction: 'normal' | 'reverseVsMexican';
	status: 'active' | 'finished';
	winner: 'player1' | 'player2' | null;
};

type ClaimResult = {
	success: boolean;
	newState?: CoreGameState;
	error?: string;
};

type BluffResult = {
	success: boolean;
	newState?: CoreGameState;
	liar: 'player1' | 'player2';
	penalty: 1 | 2;
	message: string;
};

export function applyClaim(
	state: CoreGameState,
	claim: number,
	actualRoll: number | null
): ClaimResult {
	if (state.status === 'finished') {
		return { success: false, error: 'Game is finished' };
	}

	const prev = state.currentClaim ? parseInt(state.currentClaim, 10) : null;

	// Mexican lockdown violation
	if (prev === 21 && claim !== 21 && claim !== 31 && claim !== 41) {
		const loser = state.currentPlayer;
		const newScore = loser === 'player1'
			? Math.max(0, state.player1Score - 2)
			: Math.max(0, state.player2Score - 2);
		const gameOver = newScore === 0;
		const otherPlayer = loser === 'player1' ? 'player2' : 'player1';
		return {
			success: true,
			newState: {
				...state,
				player1Score: loser === 'player1' ? newScore : state.player1Score,
				player2Score: loser === 'player2' ? newScore : state.player2Score,
				currentPlayer: otherPlayer,
				currentRoll: null,
				currentClaim: null,
				baselineClaim: null,
				lastAction: 'normal',
				status: gameOver ? 'finished' : 'active',
				winner: gameOver ? otherPlayer : null,
			},
		};
	}

	// Check if claim is legal
	const claimToCheck = state.baselineClaim ? parseInt(state.baselineClaim, 10) : prev;
	if (!isLegalRaise(claimToCheck, claim)) {
		return {
			success: false,
			error: claimToCheck == null
				? 'Choose a valid claim'
				: `Claim ${claim} must beat ${claimToCheck}`,
		};
	}

	// Social (41) - must be shown, not bluffed
	if (claim === 41) {
		if (actualRoll !== 41) {
			return { success: false, error: '41 is Social and must be shown, not bluffed' };
		}
		const otherPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';
		return {
			success: true,
			newState: {
				...state,
				currentPlayer: otherPlayer,
				currentRoll: null,
				currentClaim: null,
				baselineClaim: null,
				lastAction: 'normal',
			},
		};
	}

	// Action type
	const action: 'normal' | 'reverseVsMexican' =
		prev === 21 && claim === 31 ? 'reverseVsMexican' : 'normal';

	// Baseline logic: preserve baseline through reverses
	const isReverseClaim = isReverseOf(prev, claim);
	const newBaseline = isReverseClaim
		? (state.baselineClaim ?? String(prev))
		: String(claim);

	// Switch turns
	const otherPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';

	return {
		success: true,
		newState: {
			...state,
			currentClaim: String(claim),
			baselineClaim: newBaseline,
			lastAction: action,
			currentPlayer: otherPlayer,
			currentRoll: null,
		},
	};
}

export function applyCallBluff(
	state: CoreGameState,
	defenderActualRoll: number
): BluffResult {
	const currentClaim = state.currentClaim ? parseInt(state.currentClaim, 10) : null;
	if (currentClaim === null) {
		throw new Error('No claim to challenge');
	}
	const caller = state.currentPlayer;
	const defender = caller === 'player1' ? 'player2' : 'player1';
	const { outcome, penalty } = resolveBluffCore(
		currentClaim,
		defenderActualRoll,
		state.lastAction === 'reverseVsMexican'
	);
	const liar = outcome === +1;
	const loser = liar ? defender : caller;
	const lossAmount: 1 | 2 = penalty;
	const newPlayer1Score = loser === 'player1'
		? Math.max(0, state.player1Score - lossAmount)
		: state.player1Score;
	const newPlayer2Score = loser === 'player2'
		? Math.max(0, state.player2Score - lossAmount)
		: state.player2Score;
	const gameOver = newPlayer1Score === 0 || newPlayer2Score === 0;
	const winner = gameOver
		? (newPlayer1Score === 0 ? 'player2' : 'player1')
		: null;
	const callerName = caller === 'player1' ? 'Player 1' : 'Player 2';
	const defenderName = defender === 'player1' ? 'Player 1' : 'Player 2';
	const defenderToldTruth = !liar;
	const message = defenderToldTruth
		? `${callerName} called bluff incorrectly. ${defenderName} was truthful. ${callerName} loses ${lossAmount} point${lossAmount > 1 ? 's' : ''}.`
		: `${callerName} called bluff correctly! ${defenderName} was lying. ${defenderName} loses ${lossAmount} point${lossAmount > 1 ? 's' : ''}.`;
	return {
		success: true,
		newState: {
			...state,
			player1Score: newPlayer1Score,
			player2Score: newPlayer2Score,
			currentPlayer: caller,
			currentRoll: null,
			currentClaim: null,
			baselineClaim: null,
			lastAction: 'normal',
			status: gameOver ? 'finished' : 'active',
			winner,
		},
		liar: liar ? defender : caller,
		penalty: lossAmount,
		message,
	};
}

export { resolveBluffCore as resolveBluff };
