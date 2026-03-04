#!/usr/bin/env python3
"""
Fetch Kaggle leaderboard positions for tracked competitions
and write them to projects/kaggle-scores.json.

Strategy
────────
1. Call /competitions/submissions/list/{id} (authenticated) to get the
   logged-in user's own submissions → best publicScore.
2. Call /competitions/{id}/leaderboard/view (paginated) and count how
   many teams beat that score to derive the rank.
   This avoids any dependency on matching team display names.

Run via GitHub Actions (see .github/workflows/update-kaggle.yml).
Requires env vars: KAGGLE_USERNAME, KAGGLE_KEY
"""

import json
import os
import sys
from datetime import datetime, timezone
import requests

# ── Config ────────────────────────────────────────────────────────────────────

PORTFOLIO_USERNAME = "leo01000111"

TRACKED_COMPETITIONS = [
    {
        "id": "house-prices-advanced-regression-techniques",
        "title": "House Prices — Advanced Regression Techniques",
        "url": "https://www.kaggle.com/competitions/house-prices-advanced-regression-techniques",
        "score_label": "RMSE",
        "lower_is_better": True,
    },
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_best_score(comp_id, lower_is_better, auth):
    """
    Return the user's best public score for this competition by fetching
    their own submission list (no name-matching needed).
    """
    url = f"https://www.kaggle.com/api/v1/competitions/submissions/list/{comp_id}"
    try:
        resp = requests.get(url, params={"page": 1, "pageSize": 100},
                            auth=auth, timeout=30)
    except requests.RequestException as e:
        print(f"  submissions fetch error: {e}", flush=True)
        return None

    print(f"  submissions HTTP {resp.status_code}", flush=True)
    if not resp.ok:
        print(f"  body: {resp.text[:400]}", flush=True)
        return None

    data = resp.json()

    # Debug: show raw structure of first entry
    if isinstance(data, list) and data:
        print(f"  first submission keys: {list(data[0].keys())}", flush=True)
        print(f"  first submission sample: {json.dumps(data[0], default=str)[:300]}", flush=True)
    elif isinstance(data, dict):
        print(f"  submissions response (dict) keys: {list(data.keys())}", flush=True)
        print(f"  sample: {json.dumps(data, default=str)[:300]}", flush=True)
        data = data.get("submissions") or data.get("results") or []

    if not data:
        print("  No submissions found.", flush=True)
        return None

    scores = []
    for sub in (data if isinstance(data, list) else []):
        raw = sub.get("publicScore") or sub.get("public_score") or sub.get("score")
        if raw is not None:
            try:
                scores.append(float(raw))
            except (ValueError, TypeError):
                pass

    if not scores:
        print("  No scored submissions found.", flush=True)
        return None

    best = min(scores) if lower_is_better else max(scores)
    print(f"  Best score: {best} (from {len(scores)} scored submissions)", flush=True)
    return best


def get_leaderboard_rank(comp_id, best_score, lower_is_better, auth):
    """
    Download the full leaderboard and count teams that beat best_score.
    rank = (number of teams with strictly better score) + 1
    Also returns total team count.
    """
    url = f"https://www.kaggle.com/api/v1/competitions/{comp_id}/leaderboard/view"
    page, page_size = 1, 1000
    all_scores = []
    total_from_api = None

    while True:
        try:
            resp = requests.get(url, params={"page": page, "pageSize": page_size},
                                auth=auth, timeout=30)
        except requests.RequestException as e:
            print(f"  leaderboard fetch error p{page}: {e}", flush=True)
            break

        if not resp.ok:
            print(f"  leaderboard HTTP {resp.status_code}: {resp.text[:200]}", flush=True)
            break

        data = resp.json()

        # Debug raw structure on page 1
        if page == 1:
            if isinstance(data, dict):
                print(f"  leaderboard top-level keys: {list(data.keys())}", flush=True)
                total_from_api = (data.get("totalEntries")
                                  or data.get("totalItems")
                                  or data.get("total"))
                subs = (data.get("submissions")
                        or data.get("results")
                        or data.get("entries") or [])
            else:
                subs = data if isinstance(data, list) else []

            if subs:
                print(f"  first entry keys: {list(subs[0].keys())}", flush=True)
                print(f"  first 3 entries: {json.dumps(subs[:3], default=str)[:400]}", flush=True)
        else:
            if isinstance(data, dict):
                subs = (data.get("submissions")
                        or data.get("results")
                        or data.get("entries") or [])
            else:
                subs = data if isinstance(data, list) else []

        for entry in subs:
            raw = (entry.get("score") or entry.get("publicScore")
                   or entry.get("public_score"))
            if raw is not None:
                try:
                    all_scores.append(float(raw))
                except (ValueError, TypeError):
                    pass

        if len(subs) < page_size:
            break
        page += 1

    if not all_scores:
        return None, None

    total = total_from_api or len(all_scores)
    if lower_is_better:
        rank = sum(1 for s in all_scores if s < best_score) + 1
    else:
        rank = sum(1 for s in all_scores if s > best_score) + 1

    return int(rank), int(total)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    kaggle_user = os.environ.get("KAGGLE_USERNAME", "").strip()
    kaggle_key  = os.environ.get("KAGGLE_KEY",  "").strip()

    if not kaggle_user or not kaggle_key:
        sys.exit("ERROR: Set KAGGLE_USERNAME and KAGGLE_KEY environment variables.")

    # Sanity-check: credentials should not contain braces (i.e. not raw JSON)
    for name, val in [("KAGGLE_USERNAME", kaggle_user), ("KAGGLE_KEY", kaggle_key)]:
        if "{" in val or "}" in val or '"' in val:
            sys.exit(
                f"ERROR: {name} looks like a JSON blob, not a plain value.\n"
                f"  Open your kaggle.json and paste ONLY the value, not the whole file.\n"
                f"  kaggle.json format: {{\"username\":\"...\",\"key\":\"...\"}}"
            )
    print(f"  KAGGLE_USERNAME set: {'yes' if kaggle_user else 'NO'} "
          f"(length {len(kaggle_user)})", flush=True)
    print(f"  KAGGLE_KEY set:      {'yes' if kaggle_key else 'NO'} "
          f"(length {len(kaggle_key)})", flush=True)

    auth = (kaggle_user, kaggle_key)

    results = []
    for comp in TRACKED_COMPETITIONS:
        comp_id = comp["id"]
        lower   = comp["lower_is_better"]
        print(f"\n── {comp_id} ──", flush=True)

        best_score = get_best_score(comp_id, lower, auth)
        if best_score is None:
            print("  Skipping — no score obtained.", flush=True)
            continue

        rank, total = get_leaderboard_rank(comp_id, best_score, lower, auth)
        if rank is None:
            print("  Skipping — could not build leaderboard.", flush=True)
            continue

        print(f"  → Rank {rank} / {total}  |  Score {best_score}", flush=True)
        results.append({
            "id":              comp_id,
            "title":           comp["title"],
            "url":             comp["url"],
            "score_label":     comp["score_label"],
            "lower_is_better": lower,
            "rank":            rank,
            "score":           best_score,
            "total":           total,
        })

    output = {
        "username":     PORTFOLIO_USERNAME,
        "profile_url":  f"https://www.kaggle.com/{PORTFOLIO_USERNAME}",
        "updated_at":   datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "competitions": results,
    }

    out_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",
        "projects",
        "kaggle-scores.json",
    )
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {len(results)} competition(s) → projects/kaggle-scores.json", flush=True)


if __name__ == "__main__":
    main()
