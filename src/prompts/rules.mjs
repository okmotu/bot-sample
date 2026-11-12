// Human-readable reminder for the example agent, not a second game engine.
// Card-specific rules and current legal actions always come from the server.
export const RULES = `
You play Айыл Өкмөтү. Win by building every landmark supplied in landmarks.
Enterprises generate income; landmarks provide abilities and are the victory condition.
Building landmarks too early can leave you without enough income to finish. Compare
investing in enterprises, building a useful landmark, and saving for a specific purchase.
Passing is legal, but is not a default recommendation. Choose your own strategy.

players[current] is the active player; playerId identifies you. cards maps enterprise IDs
to total copies, closed maps IDs to closed copies (a subset of cards). Missing counts are zero.
Each open copy activates independently when the dice total matches its activation list.
Blue: any player's turn. Green and purple: only the owner's turn. Red: a rival's turn,
paid by that rival. Payments between players cannot exceed the payer's coins.
Red payments happen first, in reverse player order; then rivals' blue income,
Autoimport if activated, the active player's ordinary effects, then special effects.
Closed copies skip their next applicable activation and reopen. They still belong to you.
Named enterprise variants are cosmetic; they use the same ID and rules.
Catalog icon denotes a group used by combo effects. Count copies, not distinct names.

In setup choose two enterprises of different colors from the offered pairs. Budget is
5 coins minus both costs; remaining coins are kept. These copies do not deplete the market.
Turns: roll, optional reroll/harbor adjustment if offered, resolve effects, then at most
one enterprise OR one landmark purchase, or pass. Purchases cannot activate retroactively.
Mining investment, when offered, is a separate end-of-turn decision.
One fair six-sided die gives each result probability 1/6. With two dice, use their sum:
2..12 have frequencies 1,2,3,4,5,6,5,4,3,2,1 out of 36. Choosing two dice is not mandatory
after building station: compare your income and rivals' income for each choice.
Duplicates are allowed except at most one copy of each purple enterprise per player.
The market is shared and finite; an emptied stack is replenished. At each complete round
the oldest stack rotates out. A round means all players taking a turn, not one player's turn.
The market grows from 10 to 12 kinds when enough players have station or by round 10.

If greenBoost is on, the base income of eligible green cards is multiplied by
1 / 1.25 / 1.5 / 1.75 for 2–3 / 4 / 5 / 6 players, rounded halves up before resource
multiplication. mall adds its fixed +1 afterward. loan, demolition, moving and soda are exempt.
With subsidies, each normal turn gets 3 coins from round 25 and 5 from round 35 before
construction, instead of zero-balance aid; extra turns do not repeat the subsidy.
When no subsidy applies, in full mode a zero balance before construction receives 1 coin
from city hall. The current round is marketState.completedRounds + 1.

Autoimport decisions are simultaneous and secret. One decision applies to all your open
copies. Others' choices remain unknown until everyone chooses or the deadline expires.
Your choice is final. Use the live catalog for payouts and activation rules.
Only listed actions are legal. Select the provided actionIndex exactly; never invent one.
`;
