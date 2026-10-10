"""Deterministic physics checks plus one seeded, real Qiskit batch smoke test."""

import json
import math
import unittest
from qiskit.quantum_info import Statevector, DensityMatrix
from qiskit.providers.basic_provider import BasicSimulator
from quantum.experiments import SETTINGS, prepare_circuit, build_case_circuits, run_case, run_case_json
from quantum.analysis import normalize_qiskit_counts, summarize_counts, analyze_chsh, CHSH_IDS


def probabilities(source, left, right):
    branches = (None,) if source == "bell" else (0, 1)
    rows = [Statevector.from_instruction(prepare_circuit(source, left, right, branch, measure=False)).probabilities_dict() for branch in branches]
    # Statevector uses Qiskit's q1q0 ordering too.
    return {key: sum(row.get(key[::-1], 0) for row in rows) / len(rows) for key in ("00", "01", "10", "11")}


class PreparationTests(unittest.TestCase):
    def test_exact_zz_and_xx_probabilities(self):
        for source, test_id, expected in (
            ("bell", "zz", [.5, 0, 0, .5]), ("mixture", "zz", [.5, 0, 0, .5]),
            ("bell", "xx", [.5, 0, 0, .5]), ("mixture", "xx", [.25] * 4),
        ):
            with self.subTest(source=source, test=test_id):
                observed = probabilities(source, *SETTINGS[test_id])
                for actual, target in zip(observed.values(), expected):
                    self.assertAlmostEqual(actual, target, places=12)

    def test_mixture_is_incoherent(self):
        branches = [DensityMatrix.from_instruction(prepare_circuit("mixture", 0, 0, branch, measure=False)).data for branch in (0, 1)]
        mixture = (branches[0] + branches[1]) / 2
        self.assertAlmostEqual(abs(mixture[0, 3]), 0)
        self.assertAlmostEqual(DensityMatrix(mixture).purity().real, .5)
        bell = DensityMatrix.from_instruction(prepare_circuit("bell", 0, 0, measure=False))
        self.assertAlmostEqual(bell.data[0, 3].real, .5)

    def test_angle_conversion_and_chsh_signs(self):
        for source in ("bell", "mixture"):
            correlations = []
            for test_id in CHSH_IDS:
                left, right = SETTINGS[test_id]
                p = probabilities(source, left, right)
                e = p["00"] + p["11"] - p["01"] - p["10"]
                expected = math.cos(math.radians(left - right)) if source == "bell" else math.cos(math.radians(left)) * math.cos(math.radians(right))
                self.assertAlmostEqual(e, expected, places=12)
                correlations.append(e)
            s = correlations[0] + correlations[1] + correlations[2] - correlations[3]
            self.assertAlmostEqual(s, 2 * math.sqrt(2) if source == "bell" else math.sqrt(2), places=12)

    def test_left_right_measurement_wiring(self):
        circuit = prepare_circuit("mixture", 0, 0, 0)
        wiring = [(circuit.find_bit(item.qubits[0]).index, circuit.find_bit(item.clbits[0]).index) for item in circuit.data if item.operation.name == "measure"]
        self.assertEqual(wiring, [(0, 0), (1, 1)])
        # Asymmetric input catches reversals that symmetric Bell counts cannot.
        self.assertEqual(normalize_qiskit_counts({"01": 7, "10": 2}), {"00": 0, "01": 2, "10": 7, "11": 0})

    def test_invalid_preparations(self):
        for args in (("cat", 0, 0), ("mixture", 0, 0), ("mixture", 0, 0, 2), ("bell", 0, 0, 0), ("bell", float("nan"), 0)):
            with self.assertRaises(ValueError):
                prepare_circuit(*args)


class AnalysisTests(unittest.TestCase):
    def test_counts_and_boundary_uncertainty(self):
        stats = summarize_counts({"00": 12, "01": 3, "10": 5, "11": 20})
        self.assertEqual(stats["shots"], 40)
        self.assertAlmostEqual(stats["correlation"], .6)
        all_match = summarize_counts({"00": 512})
        self.assertLess(all_match["match_interval"][0], 1)
        self.assertEqual(all_match["match_interval"][1], 1)
        tiny = summarize_counts({"01": 1})
        self.assertEqual(tiny["match_interval"], [0, 1])

    def test_invalid_and_empty_counts(self):
        for bad in ({}, {"00": 0}, {"00": -1}, {"00": 1.5}, {"00": True}, {"000": 1}, {"0x0": 1}, {"0 0": 1}, None):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                normalize_qiskit_counts(bad)
        for alpha in (0, 1, -1, float("nan")):
            with self.assertRaises(ValueError):
                summarize_counts({"00": 1}, alpha)

    def test_chsh_calculation_and_interval(self):
        rows = {key: {"00": 4268, "11": 4268, "01": 732, "10": 732} for key in CHSH_IDS}
        rows["chsh11"] = {"00": 732, "11": 732, "01": 4268, "10": 4268}
        stats = analyze_chsh(rows)
        self.assertAlmostEqual(stats["s"], 2.8288)
        self.assertLess(stats["interval"][0], 2 * math.sqrt(2))
        self.assertGreater(stats["interval"][1], 2 * math.sqrt(2))
        self.assertTrue(stats["exceeds_positive_bound"])
        low_shots = {key: {"00": 1} for key in CHSH_IDS}
        self.assertFalse(analyze_chsh(low_shots)["exceeds_positive_bound"])
        self.assertEqual(analyze_chsh(low_shots)["s"], 2)
        with self.assertRaises(ValueError):
            analyze_chsh({"chsh00": {"00": 10}})


class RecordingBackend:
    name = "BasicSimulator (seeded local check)"

    def __init__(self):
        self.calls = 0

    def run(self, circuits, shots):
        self.calls += 1
        self.circuits = circuits
        return BasicSimulator().run(circuits, shots=shots, seed_simulator=187)


class ExecutionTests(unittest.TestCase):
    def test_one_real_job_complete_manifest_and_actual_totals(self):
        backend = RecordingBackend()
        payload = json.loads(run_case_json(backend, 128))
        self.assertEqual(backend.calls, 1)
        self.assertEqual(len(backend.circuits), 24)
        self.assertEqual(len({c.name for c in backend.circuits}), 24)
        self.assertEqual(payload["provenance"]["kind"], "selected-backend")
        for source in ("bell", "mixture"):
            self.assertEqual(set(payload["bank"][source]), set(SETTINGS))
            for row in payload["bank"][source].values():
                self.assertEqual(row["statistics"]["shots"], 256)
                self.assertEqual(row["branch_shots"], [128, 128])
            self.assertEqual(payload["bank"][source]["zz"]["statistics"]["match_rate"], 1)
        self.assertEqual(payload["bank"]["mixture"]["zz"]["counts"], {"00": 128, "01": 0, "10": 0, "11": 128})
        self.assertEqual(payload["bank"]["bell"]["xx"]["statistics"]["match_rate"], 1)
        self.assertAlmostEqual(payload["bank"]["mixture"]["xx"]["statistics"]["match_rate"], .5, delta=.12)

    def test_manifest_has_equal_mixture_branches(self):
        circuits, manifest = build_case_circuits()
        self.assertTrue(all(c.num_qubits == 2 for c in circuits))
        for test_id in SETTINGS:
            self.assertEqual([branch for source, test, branch in manifest if source == "mixture" and test == test_id], [0, 1])

    def test_backend_failure_is_not_replaced(self):
        class FailedBackend:
            def run(self, circuits, shots):
                raise RuntimeError("job rejected")
        with self.assertRaisesRegex(RuntimeError, "job rejected"):
            run_case(FailedBackend())

    def test_unequal_returned_branches_rejected(self):
        class BadResult:
            def run(self, circuits, shots): return self
            def result(self): return self
            def get_counts(self, index): return {"00": 9 if index == 13 else 10}
        with self.assertRaisesRegex(ValueError, "Unequal"):
            run_case(BadResult())

    def test_invalid_shot_requests_before_execution(self):
        backend = RecordingBackend()
        for shots in (0, -1, True, 1.5, 4097):
            with self.assertRaises(ValueError):
                run_case(backend, shots)
        self.assertEqual(backend.calls, 0)


if __name__ == "__main__":
    unittest.main()
