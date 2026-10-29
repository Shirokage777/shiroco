"""Cheap check for the Crossroads Companion app: runs the test suite (card data, privacy, noindex).

  python check.py      last line: PASS / FAIL crossroads-companion: <summary>; exit 1 on FAIL
"""
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
run = subprocess.run("npm test", cwd=HERE, shell=True, capture_output=True, text=True,
                     env=dict(os.environ, NO_COLOR="1"))
tail = [line for line in (run.stdout + run.stderr).splitlines() if "Tests" in line]
summary = tail[-1].strip() if tail else "no test summary"

if run.returncode == 0:
    print(f"PASS crossroads-companion: {summary}")
else:
    print(f"FAIL crossroads-companion: {summary}")
    sys.exit(1)
