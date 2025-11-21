# learning_ai_opponent.py
from dataclasses import dataclass, field
from collections import defaultdict
import random, numpy as np


@dataclass
class BetaTracker:
    alpha: float = 1.0
    beta: float = 1.0

    def mean(self) -> float:
        return self.alpha / (self.alpha + self.beta)

    def thompson(self) -> float:
        return random.betavariate(self.alpha, self.beta)

    def update(self, success: bool):
        if success:
            self.alpha += 1.0
        else:
            self.beta += 1.0


@dataclass
class OpponentProfile:
    bluff_rate: dict = field(
        default_factory=lambda: {
            "mexican": BetaTracker(1, 3),
            "double": BetaTracker(1, 2),
            "normal": BetaTracker(1, 1),
            # add "special" if needed (e.g., 31/41)
        }
    )
    call_rate: BetaTracker = field(default_factory=lambda: BetaTracker(1, 2))
    small_raise_pref: BetaTracker = field(default_factory=lambda: BetaTracker(1, 1))


class LinUCB:
    def __init__(self, d: int, alpha: float = 0.9):
        self.d = d
        self.alpha = alpha
        self.A = np.eye(d)
        self.b = np.zeros((d, 1))

    def _Ainv(self):
        return np.linalg.inv(self.A)

    def choose(self, contexts: dict):
        Ainv = self._Ainv()
        theta = Ainv @ self.b
        scores = {}
        for act, x in contexts.items():
            x = x.reshape(-1, 1)
            mu = float(theta.T @ x)
            bonus = self.alpha * float(np.sqrt(x.T @ Ainv @ x))
            scores[act] = mu + bonus
        return max(scores, key=scores.get), scores

    def update(self, x, reward: float):
        x = x.reshape(-1, 1)
        self.A += x @ x.T
        self.b += reward * x


class LearningAIDiceOpponent:
    def __init__(self, player_id="CPU"):
        self.player_id = player_id
        self.compare_claims = None
        self.next_higher_claim = None
        self.categorize_claim = None
        self.claim_matches_roll = None
        self._profiles = defaultdict(OpponentProfile)
        self._d = 9
        self.bandit = LinUCB(d=self._d, alpha=0.9)
        self.call_risk_bias = 0.05
        self.raise_bluff_cap = 0.60
        self.truth_bias = 0.15
        self._last_context = None

    def set_rules(self, compare_claims, next_higher_claim, categorize_claim, claim_matches_roll):
        self.compare_claims = compare_claims
        self.next_higher_claim = next_higher_claim
        self.categorize_claim = categorize_claim
        self.claim_matches_roll = claim_matches_roll

    def decide_action(self, opponent_id, current_claim, my_roll, round_index: int = 0):
        assert all(
            [
                self.compare_claims,
                self.next_higher_claim,
                self.categorize_claim,
                self.claim_matches_roll,
            ]
        )

        if current_claim is None:
            opening = self._canonical_claim_from_roll(my_roll)
            if self._is_weak_truth(opening):
                opening = self._pressure_jump_above((3, 2))
            self._last_context = None
            return {"type": "raise", "claim": opening}

        truthful = self._best_truthful_above(current_claim, my_roll)
        if truthful is not None and random.random() < (0.65 + self.truth_bias):
            self._last_context = None
            return {"type": "raise", "claim": truthful}

        opp = self._profiles[opponent_id]
        cat = self.categorize_claim(current_claim)
        cat_bluff_mean = opp.bluff_rate.get(cat, BetaTracker(1, 1)).mean()
        p_call_mean = opp.call_rate.mean()
        dist = self._distance_from_next(current_claim, my_roll)

        ctx_call = self._make_context(
            current_claim,
            round_index,
            self._cat_onehot(cat),
            cat_bluff_mean,
            p_call_mean,
            truthful is not None,
            dist,
            0.0,
        )
        ctx_raise = self._make_context(
            current_claim,
            round_index,
            self._cat_onehot(cat),
            cat_bluff_mean,
            p_call_mean,
            truthful is not None,
            dist,
            1.0,
        )

        choice, _ = self.bandit.choose({"CALL": ctx_call, "RAISE": ctx_raise})

        if choice == "CALL":
            p_bluff_sample = opp.bluff_rate.get(cat, BetaTracker(1, 1)).thompson()
            ev_call = (2 * p_bluff_sample - 1) - self.call_risk_bias
            if ev_call >= -0.15:
                self._last_context = (opponent_id, "CALL", ctx_call)
                return {"type": "call_bluff"}

        if truthful is not None:
            claim = (
                truthful
                if random.random() < (0.7 + self.truth_bias)
                else self._pick_pressure_claim(current_claim, True, opp)
            )
        else:
            claim = self._pick_pressure_claim(current_claim, True, opp)
        self._last_context = (opponent_id, "RAISE", ctx_raise)
        return {"type": "raise", "claim": claim}

    def observe_showdown(self, opponent_id, opponent_claim, actual_opponent_roll, caller_is_cpu: bool):
        was_bluff = not self.claim_matches_roll(opponent_claim, actual_opponent_roll)
        cat = self.categorize_claim(opponent_claim)
        self._profiles[opponent_id].bluff_rate.setdefault(cat, BetaTracker(1, 1)).update(success=was_bluff)

    def observe_our_raise_resolved(self, opponent_id, cpu_claim, cpu_roll, opponent_called: bool):
        self._profiles[opponent_id].call_rate.update(success=opponent_called)

    def observe_opponent_raise_size(self, opponent_id, current_claim, new_claim):
        small = self._step_distance(current_claim, new_claim) == 1
        self._profiles[opponent_id].small_raise_pref.update(success=small)

    def observe_round_outcome(self, did_cpu_win_round: bool):
        if self._last_context is None:
            return
        _, _, ctx = self._last_context
        reward = 1.0 if did_cpu_win_round else -1.0
        self.bandit.update(ctx, reward)
        self._last_context = None

    # --- utilities ---
    def _canonical_claim_from_roll(self, roll):
        hi, lo = max(roll), min(roll)
        return (hi, lo)

    def _best_truthful_above(self, current_claim, my_roll):
        truth_claim = self._canonical_claim_from_roll(my_roll)
        return truth_claim if self.compare_claims(truth_claim, current_claim) > 0 else None

    def _pick_pressure_claim(self, current_claim, allow_bluff: bool, opp: OpponentProfile):
        step = 1
        p_call = opp.call_rate.mean()
        if allow_bluff:
            extra = 0
            r = random.random()
            if p_call > 0.55 and r < 0.50:
                extra = 1
            if p_call > 0.65 and r < 0.25:
                extra = 2
            step += extra
        claim = current_claim
        for _ in range(step):
            claim = self.next_higher_claim(claim)
        return claim

    def _pressure_jump_above(self, baseline):
        claim = baseline
        for _ in range(random.choice([1, 1, 2])):
            claim = self.next_higher_claim(claim)
        return claim

    def _is_weak_truth(self, claim):
        return self.categorize_claim(claim) == "normal"

    def _cat_onehot(self, cat: str):
        return np.array(
            [
                1.0 if cat == "mexican" else 0.0,
                1.0 if cat == "double" else 0.0,
                1.0 if cat == "normal" else 0.0,
            ],
            dtype=float,
        )

    def _distance_from_next(self, current_claim, my_roll):
        truth = self._canonical_claim_from_roll(my_roll)
        if self.compare_claims(truth, current_claim) <= 0:
            return 0.0
        steps, cur = 0, current_claim
        while self.compare_claims(cur, truth) < 0 and steps < 20:
            cur = self.next_higher_claim(cur)
            steps += 1
        return float(steps)

    def _step_distance(self, a, b):
        if self.compare_claims(a, b) >= 0:
            return 0
        steps, cur = 0, a
        while self.compare_claims(cur, b) < 0 and steps < 30:
            cur = self.next_higher_claim(cur)
            steps += 1
        return steps

    def state(self):
        out = {"profiles": {}, "bandit": {"A": self.bandit.A.tolist(), "b": self.bandit.b.flatten().tolist()}}
        for opp_id, p in self._profiles.items():
            out["profiles"][opp_id] = {
                "bluff_rate": {k: (v.alpha, v.beta) for k, v in p.bluff_rate.items()},
                "call_rate": (p.call_rate.alpha, p.call_rate.beta),
                "small_raise_pref": (p.small_raise_pref.alpha, p.small_raise_pref.beta),
            }
        return out

    def load_state(self, state):
        if "bandit" in state:
            self.bandit.A = np.array(state["bandit"]["A"], dtype=float)
            self.bandit.b = np.array(state["bandit"]["b"], dtype=float).reshape(-1, 1)
        for opp_id, data in state.get("profiles", {}).items():
            prof = OpponentProfile()
            for k, (a, b) in data["bluff_rate"].items():
                prof.bluff_rate.setdefault(k, BetaTracker(1, 1))
                prof.bluff_rate[k].alpha = a
                prof.bluff_rate[k].beta = b
            a, b = data["call_rate"]
            prof.call_rate.alpha, prof.call_rate.beta = a, b
            a, b = data["small_raise_pref"]
            prof.small_raise_pref.alpha, prof.small_raise_pref.beta = a, b
            self._profiles[opp_id] = prof

