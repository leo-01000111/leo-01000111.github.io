#!/usr/bin/env python3
"""
Fetch Kaggle leaderboard positions for tracked competitions
and write them to projects/kaggle-scores.json.

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

# Add entries here every time you join a new Kaggle competition.
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

def fetch_user_rank(comp_id, username, kaggle_user, kaggle_key):
    """
    Page through the competition leaderboard until we find the user.
    Returns {"rank": int, "score": str|None, "total": int} or None.
    """
    url = f"https://www.kaggle.com/api/v1/competitions/{comp_id}/leaderboard/view"
    auth = (kaggle_user, kaggle_key)
    page, page_size = 1, 1000
    total = None

    while True:
        try:
            resp = requests.get(
                url,
                params={"page": page, "pageSize": page_size},
                auth=auth,
                timeout=30,
            )
        except requests.RequestException as e:
            print(f"  Network error on page {page}: {e}", flush=True)
            return None

        if not resp.ok:
            print(f"  HTTP {resp.status_code}: {resp.text[:300]}", flush=True)
            return None

        data = resp.json()
        submissions = data.get("submissions", [])

        # Capture total from first page
        if total is None:
            total = (
                data.get("totalEntries")
                or data.get("totalItems")
                or data.get("total")
            )

        for entry in submissions:
            team_name = (
                entry.get("teamName")
                or entry.get("team_name")
                or ""
            )
            if team_name.lower() == username.lower():
                rank  = entry.get("rank")
                score = entry.get("score")
                return {
                    "rank":  int(rank) if rank is not None else None,
                    "score": score,
                    "total": int(total) if total else None,
                }

        # If we got fewer results than page_size we've hit the last page
        if len(submissions) < page_size:
            # Update total with last known count
            if total is None:
                total = (page - 1) * page_size + len(submissions)
            break

        page += 1

    print(f"  User '{username}' not found in leaderboard.", flush=True)
    return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    kaggle_user = os.environ.get("KAGGLE_USERNAME", "").strip()
    kaggle_key  = os.environ.get("KAGGLE_KEY",  "").strip()

    if not kaggle_user or not kaggle_key:
        sys.exit("ERROR: Set KAGGLE_USERNAME and KAGGLE_KEY environment variables.")

    results = []
    for comp in TRACKED_COMPETITIONS:
        comp_id = comp["id"]
        print(f"Fetching {comp_id} ...", flush=True)
        entry = fetch_user_rank(comp_id, PORTFOLIO_USERNAME, kaggle_user, kaggle_key)

        if entry:
            results.append({
                "id":             comp_id,
                "title":          comp["title"],
                "url":            comp["url"],
                "score_label":    comp["score_label"],
                "lower_is_better": comp["lower_is_better"],
                "rank":           entry["rank"],
                "score":          entry["score"],
                "total":          entry["total"],
            })
            print(
                f"  ✓  Rank {entry['rank']} / {entry['total']}  "
                f"| Score: {entry['score']}",
                flush=True,
            )
        else:
            print(f"  ✗  Could not retrieve data for {comp_id}", flush=True)

    output = {
        "username":    PORTFOLIO_USERNAME,
        "profile_url": f"https://www.kaggle.com/{PORTFOLIO_USERNAME}",
        "updated_at":  datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
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
