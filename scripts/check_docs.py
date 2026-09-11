"""Check repository Markdown destinations and GitHub-style heading anchors offline."""

import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
documents = sorted(
    set(ROOT.glob("*.md")) | set((ROOT / "docs").rglob("*.md")) | set((ROOT / ".github").rglob("*.md"))
)


def anchors(path):
    counts, result = {}, set()
    for heading in re.findall(r"^#{1,6}\s+(.+)$", path.read_text(), re.M):
        slug = re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
        count = counts.get(slug, 0)
        result.add(f"{slug}-{count}" if count else slug)
        counts[slug] = count + 1
    return result


errors, checked = [], 0
for document in documents:
    content = re.sub(r"```.*?```", "", document.read_text(), flags=re.S)
    for raw in re.findall(r"\]\(([^\s)]+)\)", content):
        link = urlsplit(raw.strip("<>"))
        if link.scheme or link.netloc:
            continue
        target = (document.parent / unquote(link.path)).resolve() if link.path else document
        checked += 1
        if not target.exists():
            errors.append(f"{document.relative_to(ROOT)}: missing {raw}")
        elif link.fragment and target.suffix == ".md" and unquote(link.fragment) not in anchors(target):
            errors.append(f"{document.relative_to(ROOT)}: missing anchor {raw}")

if errors:
    raise SystemExit("\n".join(errors))
print(f"Verified {checked} local links across {len(documents)} Markdown documents.")
