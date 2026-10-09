#!/usr/bin/env python3
"""Build static legal pages from legal/*.md into public/*.html.

Source of truth stays in legal/*.md — rerun this script after editing them.
Keeps the converter deliberately small: the docs only use #, ##, **bold**,
[links](url), - lists, and plain paragraphs.
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = [
    ("legal/refund-policy.md", "public/refund-policy.html", "Refund Policy — Career Chief"),
    ("legal/privacy-policy.md", "public/privacy-policy.html", "Privacy Policy — Career Chief"),
    ("legal/terms-of-service.md", "public/terms-of-service.html", "Terms of Service — Career Chief"),
]

CSS = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1c1c1e; background: #fafaf8; line-height: 1.65; }
main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
nav.top { max-width: 42rem; margin: 0 auto; padding: 1.25rem 1.5rem 0; font-size: 0.9rem; }
nav.top a { color: #4a6fa5; text-decoration: none; }
h1 { font-size: 1.75rem; line-height: 1.25; margin: 0.5rem 0 0.25rem; letter-spacing: -0.01em; }
h2 { font-size: 1.15rem; margin: 2rem 0 0.5rem; }
p, li { font-size: 1rem; }
ul { padding-left: 1.4rem; }
li { margin: 0.3rem 0; }
a { color: #4a6fa5; }
.meta { color: #6b6b70; font-size: 0.92rem; }
.meta p { margin: 0.15rem 0; }
footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid #e3e1dc; font-size: 0.88rem; color: #6b6b70; }
footer a { margin-right: 1.1rem; }
"""

FOOTER_LINKS = (
    '<a href="/refund-policy.html">Refund Policy</a>'
    '<a href="/privacy-policy.html">Privacy</a>'
    '<a href="/terms-of-service.html">Terms</a>'
    '<a href="mailto:support@dannyjones.ai">support@dannyjones.ai</a>'
)

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<style>{css}</style>
</head>
<body>
<nav class="top"><a href="/">&larr; Career Chief</a></nav>
<main>
{body}
<footer>{footer}</footer>
</main>
</body>
</html>
"""


def inline(text):
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    return text


def convert(md_path):
    lines = pathlib.Path(md_path).read_text().splitlines()
    out = []
    in_list = False
    in_meta = False

    def close_list():
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    def close_meta():
        nonlocal in_meta
        if in_meta:
            out.append("</div>")
            in_meta = False

    for raw in lines:
        line = raw.strip()
        if not line:
            close_list()
            close_meta()
            continue
        if line.startswith("# "):
            close_list()
            close_meta()
            out.append(f"<h1>{inline(line[2:])}</h1>")
            continue
        if line.startswith("## "):
            close_list()
            close_meta()
            out.append(f"<h2>{inline(line[3:])}</h2>")
            continue
        if line.startswith("- "):
            close_meta()
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(line[2:])}</li>")
            continue
        # The **Key:** lines right after the h1 are document metadata.
        if line.startswith("**") and out and out[-1].startswith("<h1>"):
            out.append('<div class="meta">')
            in_meta = True
        if in_meta:
            out.append(f"<p>{inline(line)}</p>")
            continue
        close_list()
        out.append(f"<p>{inline(line)}</p>")

    close_list()
    close_meta()
    return "\n".join(out)


def main():
    for src, dst, title in PAGES:
        body = convert(ROOT / src)
        page = TEMPLATE.format(title=html.escape(title), css=CSS, body=body, footer=FOOTER_LINKS)
        target = ROOT / dst
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page)
        print(f"wrote {dst} ({len(page)} bytes)")


if __name__ == "__main__":
    main()
