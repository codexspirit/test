# WuWa Roster Artifact Builder

Builds a local artifact (`dist/index.html`) that includes:
- all playable characters (Resonators)
- all weapons
- filtered buckets for standard characters / standard weapons
- optional signature-weapon matches when detected from source metadata
- copyable/selectable text output

## Usage

```bash
python3 build_wuwa_artifact.py
```

Then open:

```bash
xdg-open dist/index.html
```

## Notes

- Data is fetched fresh at build time from public WuWa wiki/list sources, so rerunning gets the latest available roster.
- If a source changes markup, rerun after adjusting parser selectors in `build_wuwa_artifact.py`.
