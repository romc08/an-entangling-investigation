"""Count statistics. Public count keys are always Left then Right."""

from math import isfinite, log, sqrt
from numbers import Integral

OUTCOMES = ("00", "01", "10", "11")
CHSH_IDS = ("chsh00", "chsh01", "chsh10", "chsh11")


def validate_counts(counts):
    if not isinstance(counts, dict) or not counts:
        raise ValueError("Expected nonempty integer outcome counts.")
    clean = dict.fromkeys(OUTCOMES, 0)
    for key, value in counts.items():
        if key not in clean or isinstance(value, bool) or not isinstance(value, Integral) or value < 0:
            raise ValueError(f"Invalid count: {key!r} = {value!r}")
        clean[key] = int(value)
    if sum(clean.values()) == 0:
        raise ValueError("The backend returned zero shots.")
    return clean


def normalize_qiskit_counts(counts):
    """Our single 2-bit register is c1c0 (Right, Left); UI uses Left, Right."""
    if not isinstance(counts, dict):
        raise ValueError("Expected a Qiskit counts dictionary.")
    # No register separators/hex accepted: these circuits have one 2-bit register.
    normalized = {}
    for key, value in counts.items():
        if key not in OUTCOMES:
            raise ValueError(f"Unexpected Qiskit bitstring: {key!r}")
        normalized[key[::-1]] = value
    return validate_counts(normalized)


def summarize_counts(counts, alpha=0.05):
    """Distribution-free Hoeffding interval for independent bounded shots.

    Unlike a plug-in standard error this remains nonzero at all-match outcomes.
    It also covers a fixed equal allocation between the two mixture branches;
    identically distributed shots are not required. It excludes device drift
    and other systematic errors.
    """
    if not isfinite(alpha) or not 0 < alpha < 1:
        raise ValueError("alpha must be between 0 and 1.")
    counts = validate_counts(counts)
    shots = sum(counts.values())
    matching = counts["00"] + counts["11"]
    p = matching / shots
    radius = sqrt(log(2 / alpha) / (2 * shots))
    interval = [max(0, p - radius), min(1, p + radius)]
    return {
        "shots": shots,
        "matching": matching,
        "differing": shots - matching,
        "match_rate": p,
        "correlation": 2 * p - 1,
        "match_interval": interval,
        "correlation_interval": [2 * x - 1 for x in interval],
        "confidence": 1 - alpha,
        "uncertainty_method": "Hoeffding; independent shots; sampling uncertainty only",
    }


def analyze_chsh(counts_by_setting, alpha=0.05):
    """S = E00 + E01 + E10 - E11, with a conservative two-sided interval.

    A weighted Hoeffding bound covers independent shots across all four tests.
    For each +/-1 shot its weight has magnitude 1/n_setting. No Gaussian
    approximation or zero-variance boundary estimate is used.
    """
    if set(counts_by_setting) != set(CHSH_IDS):
        raise ValueError("CHSH requires exactly all four settings.")
    stats = {key: summarize_counts(counts_by_setting[key], alpha) for key in CHSH_IDS}
    s = sum(sign * stats[key]["correlation"] for key, sign in zip(CHSH_IDS, (1, 1, 1, -1)))
    radius = sqrt(2 * log(2 / alpha) * sum(1 / row["shots"] for row in stats.values()))
    interval = [max(-4, s - radius), min(4, s + radius)]
    return {
        "s": s, "interval": interval, "confidence": 1 - alpha,
        "correlations": {key: row["correlation"] for key, row in stats.items()},
        "ideal_bell": 2 * sqrt(2), "classical_bound": 2,
        "exceeds_positive_bound": interval[0] > 2,
        "uncertainty_method": "Weighted Hoeffding; independent shots; sampling uncertainty only",
        "caveat": "The expectation bound assumes the CHSH local model, independent setting choices, and fair sampling. A low S does not prove separability. This simulator is not a loophole-free Bell test or a demonstration of computational advantage.",
    }
