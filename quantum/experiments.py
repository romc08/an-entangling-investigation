"""Construct the whole case and submit exactly one job on the supplied backend."""

import json
from math import isfinite, radians
from qiskit import QuantumCircuit
from .analysis import OUTCOMES, CHSH_IDS, normalize_qiskit_counts, summarize_counts, analyze_chsh

SETTINGS = {
    "zz": (0, 0), "xx": (90, 90),
    "chsh00": (0, 45), "chsh01": (0, -45),
    "chsh10": (90, 45), "chsh11": (90, -45),
}


def prepare_circuit(source, left_degrees, right_degrees, branch=None, measure=True):
    if source not in ("bell", "mixture"):
        raise ValueError("Unknown preparation.")
    if source == "mixture" and (type(branch) is not int or branch not in (0, 1)):
        raise ValueError("A mixture circuit must specify product branch 0 or 1.")
    if source == "bell" and branch is not None:
        raise ValueError("Bell preparation has no product branch.")
    if not all(isfinite(angle) for angle in (left_degrees, right_degrees)):
        raise ValueError("Measurement angles must be finite degrees.")
    circuit = QuantumCircuit(2, 2) if measure else QuantumCircuit(2)
    if source == "bell":
        circuit.h(0)
        circuit.cx(0, 1)
    elif branch == 1:
        circuit.x(0)
        circuit.x(1)
    # Every shot starts in |00>; each circuit prepares a fresh state.
    circuit.ry(-radians(left_degrees), 0)
    circuit.ry(-radians(right_degrees), 1)
    if measure:
        circuit.measure([0, 1], [0, 1])
    return circuit


def build_case_circuits():
    circuits, manifest = [], []
    for source in ("bell", "mixture"):
        for test_id, (left, right) in SETTINGS.items():
            for repeat, branch in enumerate((None, None) if source == "bell" else (0, 1)):
                circuit = prepare_circuit(source, left, right, branch)
                circuit.name = f"{source}_{test_id}_{repeat}"
                circuits.append(circuit)
                manifest.append((source, test_id, branch))
    return circuits, manifest


def run_case(backend, shots_per_circuit=512):
    if type(shots_per_circuit) is not int or not 1 <= shots_per_circuit <= 4096:
        raise ValueError("Request 1 to 4096 shots per circuit.")
    circuits, manifest = build_case_circuits()
    # Qollab compiles for the chosen backend. Never construct another backend.
    job = backend.run(circuits, shots=shots_per_circuit)
    result = job.result()
    bank = {source: {} for source in ("bell", "mixture")}
    for index, (source, test_id, branch) in enumerate(manifest):
        counts = normalize_qiskit_counts(result.get_counts(index))
        row = bank[source].setdefault(test_id, {
            "test_id": test_id,
            "settings": {"left": SETTINGS[test_id][0], "right": SETTINGS[test_id][1]},
            "counts": dict.fromkeys(OUTCOMES, 0), "branch_shots": [],
        })
        row["branch_shots"].append(sum(counts.values()))
        for key in OUTCOMES:
            row["counts"][key] += counts[key]
    for source, rows in bank.items():
        for row in rows.values():
            if source == "mixture" and len(set(row["branch_shots"])) != 1:
                raise ValueError("Unequal returned branch shots cannot represent the equal mixture.")
            row["statistics"] = summarize_counts(row["counts"])
    backend_name = getattr(backend, "name", "Qollab selected backend")
    if callable(backend_name):
        backend_name = backend_name()
    return {
        "schema_version": 1, "bank": bank,
        "provenance": {"kind": "selected-backend", "label": str(backend_name)},
        "requested_shots_per_circuit": shots_per_circuit, "circuit_count": len(circuits),
        "chsh": {source: analyze_chsh({key: rows[key]["counts"] for key in CHSH_IDS}) for source, rows in bank.items()},
    }


def run_case_json(backend, shots_per_circuit=512):
    """A JSON string avoids nested Python dict/Map proxy differences in JS."""
    return json.dumps(run_case(backend, shots_per_circuit), allow_nan=False)
