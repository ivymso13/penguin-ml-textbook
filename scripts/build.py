"""Build portable static assets; never run Python on the production server."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(ROOT / "scripts/create_notebook.py")], check=True)
subprocess.run([
    sys.executable, "-m", "jupyter", "lite", "build",
    "--contents", "content", "--output-dir", "dist/lite",
    "--no-sourcemaps", "--no-unused-shared-packages",
], cwd=ROOT, check=True)
for path in (ROOT / "web").iterdir():
    if path.is_file():
        shutil.copy2(path, ROOT / "dist" / path.name)
download = ROOT / "dist/downloads"
download.mkdir(exist_ok=True)
shutil.copy2(ROOT / "content/01-penguins.ipynb", download)
shutil.copy2(ROOT / "content/penguins_size.csv", download)
print("Ready: python3 -m http.server 8000 --directory dist")
