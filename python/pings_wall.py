"""
Publishes the daily Pings wall on Steem.

Every ping on cur8.fun is a top-level reply to the most recent wall, so this
script only has to create one root post per day. It is meant to run as a
daily PythonAnywhere scheduled task (e.g. 00:05 UTC) from the backend folder
that holds config.py:

    python3 pings_wall.py            # publish today's wall if missing
    python3 pings_wall.py --dry-run  # show what would be published

The wall is authored by micro.cur8 and signed with cur8's posting key
(config.CUR8_POSTING_STEEM), so micro.cur8 must list cur8 in its posting
account_auths. Running it more than once a day is safe: if today's wall
already exists nothing is broadcast.
"""
import argparse
import json
import sys
from datetime import datetime, timezone

from beem import Steem
from beem.comment import Comment
from beem.exceptions import ContentDoesNotExistsException
from beem.transactionbuilder import TransactionBuilder
from beembase import operations

import config

NODES = [
    "https://api.steemit.com",
    "https://api.moecki.online",
    "https://api.steemyy.com",
]

WALL_ACCOUNT = "micro.cur8"
COMMUNITY = "hive-159863"  # Cur8 community on Steem
PINGS_URL = "https://cur8.fun/pings"


def wall_permlink(day):
    return f"pings-{day:%Y%m%d}"


def wall_title(day):
    return f"Cur8 Pings · {day:%b} {day.day}, {day.year}"


def wall_body():
    return (
        "Daily wall for **Cur8 Pings**, short posts from the Steem community.\n\n"
        "Every direct reply to this post is a ping. "
        f"Read and write pings on [cur8.fun/pings]({PINGS_URL})."
    )


def wall_exists(stm, permlink):
    try:
        Comment(f"@{WALL_ACCOUNT}/{permlink}", blockchain_instance=stm)
        return True
    except ContentDoesNotExistsException:
        return False


def build_operation(day):
    metadata = {
        "app": "cur8.fun",
        "format": "markdown",
        "type": "pings-container",
        "tags": [COMMUNITY, "cur8", "pings"],
    }
    return operations.Comment(**{
        "parent_author": "",
        "parent_permlink": COMMUNITY,
        "author": WALL_ACCOUNT,
        "permlink": wall_permlink(day),
        "title": wall_title(day),
        "body": wall_body(),
        "json_metadata": json.dumps(metadata),
    })


def main():
    parser = argparse.ArgumentParser(description="Publish the daily Pings wall")
    parser.add_argument("--dry-run", action="store_true", help="do not broadcast")
    args = parser.parse_args()

    day = datetime.now(timezone.utc).date()
    permlink = wall_permlink(day)
    stm = Steem(node=NODES, nobroadcast=args.dry_run)

    if wall_exists(stm, permlink):
        print(f"[pings_wall] @{WALL_ACCOUNT}/{permlink} already exists, nothing to do")
        return 0

    op = build_operation(day)
    if args.dry_run:
        print(f"[pings_wall] dry run, would publish @{WALL_ACCOUNT}/{permlink}:")
        print(json.dumps(op.json(), indent=2))
        return 0

    tx = TransactionBuilder(blockchain_instance=stm)
    tx.appendOps(op)
    tx.appendWif(config.CUR8_POSTING_STEEM)
    tx.sign()
    result = tx.broadcast()
    print(f"[pings_wall] published @{WALL_ACCOUNT}/{permlink} (trx {result.get('trx_id', '?')})")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # non-zero exit so the failure shows in the task log
        print(f"[pings_wall] failed: {exc}", file=sys.stderr)
        sys.exit(1)
