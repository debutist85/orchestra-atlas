# Instrument pack exports

## Current local integration

The latest pass reduces Marimba to 5.98 MB and Piano to 7.99 MB. Marimba has
114,001 triangles and one material draw; Piano uses smaller texture maps with
its logo color map preserved. See [measurements and visual review](../reports/assets/marimba-piano-optimization.md).

Every model slot now selects optimized local delivery, including the texture-only
optimized derivative of the earlier R2 Contrabass. Its canonical and staging
copies are both 3.23 MB; the exact R2 original remains in `contrabass-r2.local/`.
See [the Contrabass review](../reports/assets/contrabass-r2-review.md).

`VITE_LOCAL_MODELS=true` is set in this workspace's `.env.local`, covering both
development and production preview builds. This switch affects instrument GLBs
only. After uploading the optimized assets, set `VITE_LOCAL_MODELS=false` and
restart/rebuild to use `VITE_MEDIA_URL`. If unset, development uses local models
and production uses the media URL.

`reports/assets/r2-model-upload.json` lists the 16 distinct selected files, their
relative media paths and checksums for all 17 instrument slots. Upload those
files under the existing media prefix without changing their relative paths.

Violin and Viola now temporarily share the optimized photographed violin and bow
at `3d/violin/violin.glb`. Both slots load the same URL to share download/decoded
resources. Identical delivery copies remain in the two instrument folders.
Previous models and selected records are backed up in
`scanned-strings.local/previous/`; full-resolution donor files are archived in
`scanned-strings.local/source/`. See
[shared scan optimization](../reports/assets/shared-scanned-strings.md).

All 17 optimized staged models are copied to their runtime paths in
`public/3d/<instrument>/<instrument>.glb`. The explorer selects their records in
`public/licenses/optimized/`. Local mode loads these files directly even with
`VITE_MEDIA_URL` set. Upload the runtime files at the same relative paths after
local review. No R2 upload has been performed by this integration.

Piano replaces Celesta in the catalogue and titles. Marimba is selected for the
existing pitched-percussion slot, and Snare drum for unpitched percussion.
Viola and Harp now also have models. The replacement flute uses the instrument
pack's credits; the replacement violin uses its embedded Sketchfab metadata.
The project-owner source links and public Sketchfab metadata identify the harp
as Selkynae's School Project Harp (CC BY 4.0), the piano as Amatsukast's Grand
Piano (CC BY-NC-SA 4.0), and the marimba as 3D Vault's Marimba (CC BY 4.0).
The piano record flags NonCommercial and ShareAlike conditions. All selected
records retain human-review status; metadata research is not publication approval.
The initially supplied HQ3DMOD harp link was corrected by the project owner and
is not used for attribution. Historical license records below are preserved.

`node tests/local-instrument-models.mjs` checks catalogue coverage, selected
credits, file hashes, staging/runtime parity and Three.js parsing for every
model. GLBs remain ignored by Git and must accompany a local checkout.

Opening orientations are configured against the replacement assets. Browser
review is still needed for framing at desktop/mobile sizes. Existing anatomy
anchors and editor drafts belong to the earlier geometry and may need authoring
for replacement models; no anatomical positions are inferred during integration.

## Historical pack export workflow

`scripts/export-blender-instruments.py` exports the current pack's twelve
`Sketchfab_model` root hierarchies into individual, self-contained GLBs. The
mapping is specific to this pack, identified from hierarchy and material names.

The current staged files are in `public/3d/instrument-pack-staging/` (ignored by
Git). Open `/3d/instrument-pack-staging/` on the Vite dev server to review them.
Ten pack instruments are used in the explorer. Like every other model, each is
configured in the single `models` table in
`src/features/instrument-explorer/content/explorable-instruments.ts`. An entry
names its license record in `public/licenses/instrument-pack/`. That record's
`assetPath` (`3d/<name>/<name>.glb`) resolves through `mediaUrl`, so the files
come from `<VITE_MEDIA_URL>/3d`, or local `/3d` without a CDN. All ten hosted
files matched the exported SHA-256 checksums when checked. To review local
exports instead, temporarily point those entries' records at the staging
files.

Flute deliberately retains the previous Basic Flute model, its rotation, and
its credits (`public/licenses/flute.json`). Its R2 file is the older model, not
the pack export. Violin also retains its existing model. Snare drum remains on
the local review page because there is no dedicated catalogue entry; its R2
pack path returned 404. The pack's horn, trumpet and trombone replaced the
earlier Sketchfab models at the same R2 paths, so those models and their
records are gone.

The R2 cello response allowed `http://localhost:5173` through CORS. It did not
return an allow-origin header for `http://127.0.0.1:5173`; use localhost for local
review, or add the actual app origin to the bucket's CORS configuration.

Each model's opening camera, rotation and hotspots are authored against its own
geometry. Hotspot editor drafts are keyed by the model's asset path, so they
never attach to a different model.

`tests/model-attribution.mjs` (part of `npm test`) checks that each model has
exactly one license record and displays that record's credits.

## Export behavior

- Temporary copies preserve the source scene, meshes, materials, and images.
- Each model is centered; source scale and orientation are retained. Physical
  dimensions have not been verified.
- Textures retain their aspect ratio and are capped at 1024 pixels per side.
- Parts and hierarchy remain separate for future anatomy work.
- Animation, cameras, lights, and other scenes are excluded.
- GLBs need no Draco or Meshopt decoder.
- Existing output files are never overwritten. Use a new output folder for
  another quality setting or export run.

The Blender bridge accepts `script_path` pointing to the script and an `args`
object. Both script access and output access must satisfy connector permissions.

```json
{
  "output": "/absolute/path/to/a/new/export-folder",
  "max_texture": 1024,
  "oboe_ratio": 0.05
}
```

An optional `instruments` array restricts the export to the listed instrument
IDs. The default oboe ratio is 1 (no reduction). The staged oboe used 0.05 on
meshes with more than 1000 polygons: 2,702,600 source triangles became 135,628.
That candidate requires close visual review before adoption.

## Validation and remaining review

All twelve staged GLBs passed CPU-side parsing with the installed Three.js
`GLTFLoader`. A Node image-bitmap shim decoded embedded images with the existing
Sharp dependency. Checks confirmed a single scene, no external image/buffer
references, maximum texture size of 1024, and finite, centered model bounds.
This verifies parsing and image decoding, not browser rendering or GPU behavior.

No browser connection was available for visual inspection. The local review
page supports orbiting each instrument; inspect appearance, seams, part
alignment, normal maps, and the reduced oboe silhouette before adoption. Blender
also warned about multiple image nodes supplying some exported textures; review
texture sampling against the source.

Files range from 3.3 MB to 21.2 MB. Bassoon and trombone still have many texture
sets (67 and 58 embedded images respectively). They need texture consolidation
or a smaller mobile variant before being treated as mobile-ready assets.

`manifest.json` records the source blend path, root mapping, triangle counts,
file sizes, export settings, and pending review status. Asset-specific records
in `public/licenses/instrument-pack/` document each GLB's path, SHA-256, export
changes, and source root. The ten verified uploads include hosted `assetPath`
and `assetUrl` fields, retaining the staging path as `localAssetPath`.

The project owner identified the purchased source as the CGTrader
[Orchestra Instrument Pack](https://www.cgtrader.com/3d-models/various/various-models/orchestra-instrument-pack).
The listing identifies AmstadDigital, model ID 6486723, and Royalty Free License
(no AI). This metadata was researched on 2026-10-23 and recorded for all twelve
pack exports. The retained Basic Flute is a separate model and keeps its
previous credits. The snare record has a null `instrumentId` because there is
no dedicated catalogue entry.

Purchase-specific license documents and attribution requirements remain
unverified; `attributionRequired` remains null and the records retain
`verificationStatus: requires-review`. CGTrader's
[terms](https://www.cgtrader.com/pages/terms-and-conditions), sections 20, 21A,
and 21B, include Incorporated Product distribution conditions, software asset
access safeguards, and a machine-learning training restriction. The publicly
accessible GLBs warrant human review against those conditions; researching
credits does not approve this distribution method. No purchase documents or
account credentials are stored in the public records.
