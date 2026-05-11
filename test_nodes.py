"""
Steem Node Benchmark — 22 API calls x 10 nodes
Usage: python test_nodes.py
Results saved to test-nodes-results.txt
"""

import requests
import time
import json
from collections import OrderedDict

NODES = [
    "https://api.wherein.io",
    "https://api.justyy.com",
    "https://api.steemyy.com",
    "https://api.moecki.online",
    "https://api.steemit.com",
    "https://api3.justyy.com",
    "https://api.steemitdev.com",
    "https://api.pennsif.net",
    "https://steemd.steemworld.org",
    "https://steemyy.com/node/",
]

TESTS = OrderedDict([
    ("condenser.get_accounts",             {"jsonrpc":"2.0","method":"condenser_api.get_accounts","params":[["steemit"]],"id":1}),
    ("condenser.get_dynamic_global_props", {"jsonrpc":"2.0","method":"condenser_api.get_dynamic_global_properties","params":[],"id":1}),
    ("condenser.get_discussions_trending", {"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_trending","params":[{"tag":"steem","limit":1}],"id":1}),
    ("condenser.get_discussions_hot",      {"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_hot","params":[{"tag":"steem","limit":1}],"id":1}),
    ("condenser.get_discussions_created",  {"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_created","params":[{"tag":"steem","limit":1}],"id":1}),
    ("condenser.get_discussions_promoted", {"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_promoted","params":[{"tag":"steem","limit":1}],"id":1}),
    ("condenser.get_discussions_blog",     {"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_blog","params":[{"tag":"steemit","limit":1}],"id":1}),
    ("condenser.get_discussions_comments", {"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_comments","params":[{"start_author":"steemit","limit":1}],"id":1}),
    ("condenser.get_content",              {"jsonrpc":"2.0","method":"condenser_api.get_content","params":["steemit","firstpost"],"id":1}),
    ("condenser.get_content_replies",      {"jsonrpc":"2.0","method":"condenser_api.get_content_replies","params":["steemit","firstpost"],"id":1}),
    ("condenser.get_trending_tags",        {"jsonrpc":"2.0","method":"condenser_api.get_trending_tags","params":["",5],"id":1}),
    ("condenser.lookup_accounts",          {"jsonrpc":"2.0","method":"condenser_api.lookup_accounts","params":["steem",5],"id":1}),
    ("condenser.get_active_votes",         {"jsonrpc":"2.0","method":"condenser_api.get_active_votes","params":["steemit","firstpost"],"id":1}),
    ("condenser.get_reward_fund",          {"jsonrpc":"2.0","method":"condenser_api.get_reward_fund","params":["post"],"id":1}),
    ("condenser.get_median_price",         {"jsonrpc":"2.0","method":"condenser_api.get_current_median_history_price","params":[],"id":1}),
    ("condenser.get_account_history",      {"jsonrpc":"2.0","method":"condenser_api.get_account_history","params":["steemit",-1,5],"id":1}),
    ("condenser.get_vesting_delegations",  {"jsonrpc":"2.0","method":"condenser_api.get_vesting_delegations","params":["steemit",None,5],"id":1}),
    ("follow.get_reblogged_by",            {"jsonrpc":"2.0","method":"follow_api.get_reblogged_by","params":{"author":"rme","permlink":"fun-meme-puss-logo-meme-banner-part-414-946-1778503804"},"id":1}),
    ("follow.get_followers",               {"jsonrpc":"2.0","method":"follow_api.get_followers","params":{"account":"steemit","start":"","type":"blog","limit":3},"id":1}),
    ("follow.get_following",               {"jsonrpc":"2.0","method":"follow_api.get_following","params":{"account":"steemit","start":"","type":"blog","limit":3},"id":1}),
    ("bridge.get_ranked_posts",            {"jsonrpc":"2.0","method":"bridge.get_ranked_posts","params":{"tag":"hive-196037","sort":"trending","limit":1},"id":1}),
    ("rc_api.find_rc_accounts",            {"jsonrpc":"2.0","method":"rc_api.find_rc_accounts","params":{"accounts":["steemit"]},"id":1}),
])

COL_W = 14
PAD = 36

def short_node(url):
    s = url.replace("https://", "").replace("api.", "").replace("steemd.", "")
    for ext in [".online", ".com", ".net", ".io", ".org"]:
        s = s.replace(ext, "")
    s = s.replace("/node/", "").rstrip("/")
    return s[:12]

# ANSI colors
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
WHITE  = "\033[97m"
RESET  = "\033[0m"

results = {node: {} for node in NODES}
plain_lines = []

def log(text, plain=None):
    print(text)
    plain_lines.append(plain if plain is not None else text)

# Header
header_plain = f"{'TEST':<{PAD}}"
header_color = f"{WHITE}{'TEST':<{PAD}}{RESET}"
for node in NODES:
    s = short_node(node)
    header_plain += f"{s:>{COL_W}}"
    header_color += f"{CYAN}{s:>{COL_W}}{RESET}"
log(header_color, header_plain)
sep = "-" * (PAD + len(NODES) * COL_W)
log(sep)

# Test loop
for test_name, body in TESTS.items():
    row_plain = f"{test_name:<{PAD}}"
    row_color = f"{WHITE}{test_name:<{PAD}}{RESET}"
    print(f"{WHITE}{test_name:<{PAD}}{RESET}", end="", flush=True)

    for node in NODES:
        try:
            start = time.time()
            r = requests.post(node, json=body, timeout=7)
            ms = int((time.time() - start) * 1000)
            data = r.json()

            if data.get("result") is not None:
                cell = f"OK {ms}ms"
                row_color += f"{GREEN}{cell:>{COL_W}}{RESET}"
                row_plain += f"{cell:>{COL_W}}"
                results[node][test_name] = ms
            else:
                code = data.get("error", {}).get("code", "?")
                cell = f"ERR {code}"
                row_color += f"{RED}{cell:>{COL_W}}{RESET}"
                row_plain += f"{cell:>{COL_W}}"
                results[node][test_name] = -1

        except Exception:
            cell = "FAIL"
            row_color += f"{RED}{cell:>{COL_W}}{RESET}"
            row_plain += f"{cell:>{COL_W}}"
            results[node][test_name] = -1

        print(f"{GREEN if results[node].get(test_name, -1) >= 0 else RED}{cell:>{COL_W}}{RESET}", end="", flush=True)

    print()
    plain_lines.append(row_plain)

log(sep)

# Summary
log("")
log(f"{YELLOW}===== RIEPILOGO ====={RESET}", "===== RIEPILOGO =====")

score_plain = f"{'Chiamate OK / ' + str(len(TESTS)):<{PAD}}"
score_color = f"{WHITE}{'Chiamate OK / ' + str(len(TESTS)):<{PAD}}{RESET}"
lat_plain   = f"{'Latenza media (ms)':<{PAD}}"
lat_color   = f"{WHITE}{'Latenza media (ms)':<{PAD}}{RESET}"

for node in NODES:
    ok = sum(1 for v in results[node].values() if v >= 0)
    total = len(TESTS)
    cell = f"{ok}/{total}"
    color = GREEN if ok == total else (YELLOW if ok > total * 0.7 else RED)
    score_color += f"{color}{cell:>{COL_W}}{RESET}"
    score_plain += f"{cell:>{COL_W}}"

    times = [v for v in results[node].values() if v >= 0]
    avg = int(sum(times) / len(times)) if times else 0
    lat_cell = f"{avg}ms"
    lat_color += f"{CYAN}{lat_cell:>{COL_W}}{RESET}"
    lat_plain += f"{lat_cell:>{COL_W}}"

log(score_color, score_plain)
log(lat_color, lat_plain)

# Save to file
out_path = "test-nodes-results.txt"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(plain_lines) + "\n")

print(f"\n{YELLOW}Risultati salvati in: {out_path}{RESET}")
