#!/usr/bin/env python3
"""
Fetch Kaggle leaderboard positions for tracked competitions
and write them to projects/kaggle-scores.json.

Uses the kaggle CLI (installed via pip install kaggle).
Credentials are read from ~/.kaggle/kaggle.json, which the
workflow writes from GitHub Secrets.

Run via GitHub Actions (see .github/workflows/update-kaggle.yml).
"""

import csv
import io
import json
import os
import sys
import subprocess
import zipfile
import tempfile
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────

PORTFOLIO_USERNAME = "leo01000111"

# Add entries here every time you join a new Kaggle competition.
TRACKED_COMPETITIONS = [
    {
        "id": "house-prices-advanced-regression-techniques",
        "title": "House Prices — Advanced Regression Techniques",
        "url": "https://www.kaggle.com/competitions/house-prices-advanced-regression-techniques",
        "repo_url": "https://github.com/leo-01000111/kaggleHPR",
        "score_label": "RMSE",
        "lower_is_better": True,
    },
    {
        "id": "spaceship-titanic",
        "title": "Spaceship Titanic",
        "url": "https://www.kaggle.com/competitions/spaceship-titanic",
        "repo_url": "https://github.com/leo-01000111/kaggleSpaceTitanic",
        "score_label": "Accuracy",
        "lower_is_better": False,
    },
    {
        "id": "cyber-physical-anomaly-detection-for-der-systems",
        "title": "Cyber-Physical Anomaly Detection for DER Systems",
        "url": "https://www.kaggle.com/competitions/cyber-physical-anomaly-detection-for-der-systems",
        "repo_url": "https://github.com/leo-01000111/kaggleDER",
        "score_label": "F2",
        "lower_is_better": False,
    },
    {
        "id": "march-machine-learning-mania-2026",
        "title": "March Machine Learning Mania 2026",
        "url": "https://www.kaggle.com/competitions/march-machine-learning-mania-2026",
        "repo_url": "https://github.com/leo-01000111/kaggleMarchMadness",
        "score_label": "Brier Score",
        "lower_is_better": True,
    },
]

# ── CLI helper ────────────────────────────────────────────────────────────────

def kaggle_cli(*args):
    """Run a kaggle CLI command and return stdout as a string."""
    cmd = ["kaggle"] + list(args)
    print(f"  $ {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"exit code {result.returncode}")
    return result.stdout

# ── Score helpers ─────────────────────────────────────────────────────────────

def get_best_submission_score(comp_id, lower_is_better):
    """Return the user's best public score from their own submissions."""
    try:
        stdout = kaggle_cli("competitions", "submissions",
                            "-c", comp_id, "--csv", "-q")
    except Exception as e:
        print(f"  submissions error: {e}", flush=True)
        return None

    reader = csv.DictReader(io.StringIO(stdout))
    print(f"  CSV columns: {reader.fieldnames}", flush=True)

    best = None
    count = 0
    for row in reader:
        count += 1
        raw = (row.get("publicScore") or row.get("public_score")
               or row.get("score") or row.get("Score"))
        if not raw or str(raw).strip() in ("", "None", "N/A", "null"):
            continue
        try:
            s = float(str(raw))
        except (ValueError, TypeError):
            continue
        if (best is None
                or (lower_is_better and s < best)
                or (not lower_is_better and s > best)):
            best = s

    print(f"  Parsed {count} submission(s), best={best}", flush=True)
    return best


def get_rank_from_leaderboard(comp_id, best_score, lower_is_better):
    """Download the full leaderboard and derive rank."""
    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            kaggle_cli("competitions", "leaderboard",
                       "-c", comp_id, "--download", "-p", tmpdir, "-q")
        except Exception as e:
            print(f"  leaderboard error: {e}", flush=True)
            return None, None

        files = os.listdir(tmpdir)
        print(f"  Downloaded files: {files}", flush=True)

        all_scores = []
        for fname in files:
            fpath = os.path.join(tmpdir, fname)
            try:
                if fname.endswith(".zip"):
                    with zipfile.ZipFile(fpath) as z:
                        print(f"  ZIP contents: {z.namelist()}", flush=True)
                        for zname in z.namelist():
                            with z.open(zname) as f:
                                content = f.read().decode("utf-8")
                            reader = csv.DictReader(io.StringIO(content))
                            print(f"  CSV columns: {reader.fieldnames}", flush=True)
                            for row in reader:
                                val = row.get("Score") or row.get("score")
                                if val:
                                    try:
                                        all_scores.append(float(val))
                                    except (ValueError, TypeError):
                                        pass
                elif fname.endswith(".csv"):
                    with open(fpath) as f:
                        reader = csv.DictReader(f)
                        print(f"  CSV columns: {reader.fieldnames}", flush=True)
                        for row in reader:
                            val = row.get("Score") or row.get("score")
                            if val:
                                try:
                                    all_scores.append(float(val))
                                except (ValueError, TypeError):
                                    pass
            except Exception as e:
                print(f"  Error reading {fname}: {e}", flush=True)

    if not all_scores:
        print("  No scores parsed from leaderboard.", flush=True)
        return None, None

    total = len(all_scores)
    if lower_is_better:
        rank = sum(1 for s in all_scores if s < best_score) + 1
    else:
        rank = sum(1 for s in all_scores if s > best_score) + 1

    return rank, total


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Sanity-check: confirm the CLI is available and credentials work
    try:
        ver = kaggle_cli("--version").strip()
        print(f"  kaggle CLI: {ver}", flush=True)
    except Exception as e:
        sys.exit(f"kaggle CLI not available: {e}")

    out_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..", "projects", "kaggle-scores.json",
    )

    # Load existing data so we can fall back to it if a fetch fails
    existing = {}
    try:
        with open(out_path) as f:
            old = json.load(f)
        for c in old.get("competitions", []):
            existing[c["id"]] = c
        print(f"  Loaded {len(existing)} existing competition(s) as fallback.", flush=True)
    except Exception:
        pass

    fresh = {}
    for comp in TRACKED_COMPETITIONS:
        comp_id = comp["id"]
        lower   = comp["lower_is_better"]
        print(f"\n── {comp_id} ──", flush=True)

        best_score = get_best_submission_score(comp_id, lower)
        if best_score is None:
            print("  No score found — will use cached data if available.", flush=True)
            continue
        print(f"  Best score: {best_score}", flush=True)

        rank, total = get_rank_from_leaderboard(comp_id, best_score, lower)
        if rank is None:
            print("  Could not determine rank — will use cached data if available.", flush=True)
            continue

        print(f"  → Rank {rank} / {total}", flush=True)
        fresh[comp_id] = {
            "id":              comp_id,
            "title":           comp["title"],
            "url":             comp["url"],
            "repo_url":        comp.get("repo_url", ""),
            "score_label":     comp["score_label"],
            "lower_is_better": lower,
            "rank":            rank,
            "score":           best_score,
            "total":           total,
        }

    # Merge: prefer fresh data, fall back to cached, preserve order
    results = []
    for comp in TRACKED_COMPETITIONS:
        comp_id = comp["id"]
        if comp_id in fresh:
            results.append(fresh[comp_id])
        elif comp_id in existing:
            print(f"  Using cached data for {comp_id}.", flush=True)
            # Keep repo_url up to date from config even when using cached data
            cached = dict(existing[comp_id])
            cached["repo_url"] = comp.get("repo_url", cached.get("repo_url", ""))
            results.append(cached)
        else:
            print(f"  No data available for {comp_id} — omitting.", flush=True)

    output = {
        "username":     PORTFOLIO_USERNAME,
        "profile_url":  f"https://www.kaggle.com/{PORTFOLIO_USERNAME}",
        "updated_at":   datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "competitions": results,
    }

    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {len(results)} competition(s) → projects/kaggle-scores.json", flush=True)


if __name__ == "__main__":
    main()
