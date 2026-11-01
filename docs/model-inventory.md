# Read-only model inventory

Run `npm run audit:models` to inspect every model under
`public/3d/instrument-pack-staging`, including alternate files absent from the
original export manifest. The directory scan is combined with that manifest,
the existing application catalogue and public model records; there is no second
hardcoded instrument list. Known missing manifest assets are reported too.

Reports are generated outside the source directory:

- [Comparison table and recommendations](../reports/assets/instrument-models.md)
- [Sortable CSV](../reports/assets/instrument-models.csv)
- [Detailed JSON](../reports/assets/instrument-models.json)

For an independent sample cross-check:

```sh
npm run audit:models -- --verify-three
npm run test:audit-models
```

`--verify-three` parses up to three distinct leaders (transfer, default-scene
triangles, image footprint) with the installed Three.js GLTFLoader and compares
scene triangle counts. Its Node image shim reads Sharp headers only; no browser,
GPU draw or full pixel-decoding measurement is implied. Only self-contained,
uncompressed GLBs are eligible for that check. Twelve original exports also
have independent Blender triangle/byte counts in the manifest.

Optional paths:

```sh
npm run audit:models -- --input public/3d/instrument-pack-staging --output-dir reports/assets --verify-three
```

The tool supports GLB/glTF 2.0 metadata, embedded/data-URI/local external
resources, and common image headers via the existing Sharp dependency. KTX2/DDS
headers are inspected conservatively without transcoding. Other model formats
are reported as unsupported. It does not download remote dependencies: those
remain explicitly unknown/partial. This avoids network requests and requires
no remote cache for the current self-contained collection.

File sizes and image dimensions are measured. Vertex counts sum unique POSITION
accessors; unique geometry and scene-instance triangle counts are separate.
RGBA memory, mip/upload configurations and primitive draw counts are estimates,
with assumptions in every report. Native/GPU memory, material pass multiplication,
visual quality and device performance require a later runtime audit.

Alternate file names are variants, not evidence of authored LODs. A shared folder
can identify an instrument without establishing a variant's provenance or rights.
The reports do not approve or alter licensing records. URL credentials/query
strings and data-URI bodies are excluded. Source models/images are never written,
and output paths resolving inside the asset directory are rejected.

Reports omit timestamps for reproducibility. Repeating a run with the same files,
metadata, options and tool version should produce identical results. A nonzero
exit code signals failed/unsupported assets; partial results and remaining valid
models are still written. Regenerate after adding/changing assets.

No new dependency was added. glTF Transform was considered; its full I/O and
extension stack is unnecessary for metadata-only counting. Installed Node,
Sharp, Vite (to resolve the actual catalogue) and optional Three.js inspection
cover this baseline. Full glTF conformance and decoder-backed compressed-geometry
validation are explicitly outside this tool's current scope.
