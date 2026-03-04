#!/usr/bin/env python3
"""
Fetch Kaggle leaderboard positions for tracked competitions
and write them to projects/kaggle-scores.json.

Run via GitHub Actions (see .github/workflows/update-kaggle.yml).
Requires env vars: KAGGLE_USERNAME, KAGGLE_KEY

How team-name matching works
────────────────────────────
Kaggle competition leaderboards show the team's *display name*, which is
often different from the URL slug (e.g. "leo01000111" → "Leon Górecki").
The script resolves this automatically:
  1. Calls /api/v1/users/{username} to get the display name.
  2. Searches the leaderboard for an entry whose teamName matches the
     display name OR the raw username (case-insensitive).
  3. Falls back to the TEAM_NAME_OVERRIDE env var if set.
"""

import json
import os
import sys
from datetime import datetime, timezone
import requests

# ── Config ────────────────────────────────────────────────────────────────────

PORTFOLIO_USERNAME = "leo01000111"   # Kaggle URL slug

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

def get_display_name(username, auth):
    """Try to fetch the display name (full name / handle) from the Kaggle API."""
    try:
        resp = requests.get(
            f"https://www.kaggle.com/api/v1/users/{username}",
            auth=auth, timeout=15,
        )
        if resp.ok:
            data = resp.json()
            # The field may be "displayName", "name", "fullName", etc.
            for key in ("displayName", "name", "fullName", "userName"):
                val = data.get(key, "").strip()
                if val:
                    print(f"  Display name resolved: '{val}' (field: {key})", flush=True)
                    return val
    except Exception as e:
        print(f"  Could not resolve display name: {e}", flush=True)
    return None


def name_matches(team_name, candidates):
    """Case-insensitive check: does team_name match any candidate?"""
    tn = (team_name or "").strip().lower()
    return any(tn == c.strip().lower() for c in candidates if c)


def fetch_user_rank(comp_id, candidates, auth):
    """
    Page through the competition leaderboard until we find the user.
    `candidates` is a list of possible team-name strings to match.
    Returns {"rank": int, "score": str|None, "total": int} or None.
    """
    url = f"https://www.kaggle.com/api/v1/competitions/{comp_id}/leaderboard/view"
    page, page_size = 1, 1000
    total = None

    print(f"  Searching leaderboard for: {candidates}", flush=True)

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

        if total is None:
            total = (
                data.get("totalEntries")
                or data.get("totalItems")
                or data.get("total")
            )

        # Debug: print first 5 team names on page 1
        if page == 1 and submissions:
            sample = [e.get("teamName", "?") for e in submissions[:5]]
            print(f"  First 5 teamNames on page 1: {sample}", flush=True)

        for entry in submissions:
            team_name = (
                entry.get("teamName")
                or entry.get("team_name")
                or ""
            )
            if name_matches(team_name, candidates):
                rank  = entry.get("rank")
                score = entry.get("score")
                print(f"  ✓ Matched '{team_name}'", flush=True)
                return {
                    "rank":  int(rank) if rank is not None else None,
                    "score": score,
                    "total": int(total) if total else None,
                }

        if len(submissions) < page_size:
            if total is None:
                total = (page - 1) * page_size + len(submissions)
            break

        page += 1

    print(f"  ✗ Not found — none of {candidates} matched any teamName.", flush=True)
    return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    kaggle_user = os.environ.get("KAGGLE_USERNAME", "").strip()
    kaggle_key  = os.environ.get("KAGGLE_KEY",  "").strip()

    if not kaggle_user or not kaggle_key:
        sys.exit("ERROR: Set KAGGLE_USERNAME and KAGGLE_KEY environment variables.")

    auth = (kaggle_user, kaggle_key)

    # Build list of name candidates to try
    candidates = [PORTFOLIO_USERNAME]

    # Optional manual override via env var (useful if auto-detection fails)
    override = os.environ.get("TEAM_NAME_OVERRIDE", "").strip()
    if override:
        candidates.insert(0, override)
        print(f"Using TEAM_NAME_OVERRIDE: '{override}'", flush=True)
    else:
        display = get_display_name(PORTFOLIO_USERNAME, auth)
        if display and display.lower() != PORTFOLIO_USERNAME.lower():
            candidates.insert(0, display)

    print(f"Name candidates: {candidates}", flush=True)

    results = []
    for comp in TRACKED_COMPETITIONS:
        comp_id = comp["id"]
        print(f"\nFetching {comp_id} ...", flush=True)
        entry = fetch_user_rank(comp_id, candidates, auth)

        if entry:
            results.append({
                "id":              comp_id,
                "title":           comp["title"],
                "url":             comp["url"],
                "score_label":     comp["score_label"],
                "lower_is_better": comp["lower_is_better"],
                "rank":            entry["rank"],
                "score":           entry["score"],
                "total":           entry["total"],
            })
            print(
                f"  Rank {entry['rank']} / {entry['total']}  |  Score: {entry['score']}",
                flush=True,
            )
        else:
            print(f"  Could not retrieve data for {comp_id}", flush=True)

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
