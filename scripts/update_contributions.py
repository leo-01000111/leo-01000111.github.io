import json
import os
import sys
import urllib.request

GH_TOKEN = os.environ.get("GH_USER_TOKEN", "")
GH_USER  = os.environ.get("GH_USER", "leo-01000111")
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "contributions.json")

QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
          }
        }
      }
    }
  }
}
"""

LEVEL_MAP = {
    "NONE": 0,
    "FIRST_QUARTILE": 1,
    "SECOND_QUARTILE": 2,
    "THIRD_QUARTILE": 3,
    "FOURTH_QUARTILE": 4,
}


def fetch():
    payload = json.dumps({"query": QUERY, "variables": {"login": GH_USER}}).encode()
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=payload,
        headers={
            "Authorization": f"Bearer {GH_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "contributions-updater/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def main():
    data = fetch()
    if "errors" in data:
        print("GraphQL errors:", data["errors"], file=sys.stderr)
        sys.exit(1)

    weeks = (
        data["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
    )
    contributions = [
        {
            "date": day["date"],
            "count": day["contributionCount"],
            "level": LEVEL_MAP.get(day["contributionLevel"], 0),
        }
        for week in weeks
        for day in week["contributionDays"]
    ]

    new_content = json.dumps({"contributions": contributions}, separators=(",", ":"))

    out = os.path.normpath(OUT_PATH)
    if os.path.exists(out):
        with open(out, "r", encoding="utf-8") as f:
            if f.read() == new_content:
                print("No change — contributions unchanged.")
                return

    with open(out, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Saved {len(contributions)} days of contribution data.")


if __name__ == "__main__":
    main()
