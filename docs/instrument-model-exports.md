# Instrument pack exports

`scripts/export-blender-instruments.py` exports the current pack's twelve
`Sketchfab_model` root hierarchies into individual, self-contained GLBs. The
mapping is specific to this pack, identified from hierarchy and material names.

The current staged files are in `public/3d/instrument-pack-staging/` (ignored by
Git). Open `/3d/instrument-pack-staging/` on the Vite dev server to review them.
The explorer selects ten matching pack instruments when
`VITE_INSTRUMENT_PACK_URL` is set. This workspace's `.env.local` and
`.env.development.local` point it to
`https://pub-1e69fc096336415dadb5875dd346a3ba.r2.dev/orchestra-atlas/3d`.
Each asset resolves as `<base>/<instrument>/<instrument>.glb`. All ten hosted
files matched the exported SHA-256 checksums when checked.

Flute deliberately retains the previous Basic Flute model, its rotation, and
its credits. Its R2 file is the older model, not the pack export. Violin also
retains its existing model. Snare drum remains on the local review page because
there is no dedicated catalogue entry; its R2 pack path returned 404.

The pack setting is independent of `VITE_MEDIA_URL`, which still serves other
media and the retained flute/violin models. Unset the pack setting to return to
the previous catalogue selection, or set it to `/3d/instrument-pack-staging`
to use the ten local pack exports. Restart Vite after changing it. Environment
files are ignored by Git; configure the same pack URL explicitly in a deployment
environment to use these models there. Rights and visual review remain pending.

The R2 cello response allowed `http://localhost:5173` through CORS. It did not
return an allow-origin header for `http://127.0.0.1:5173`; use localhost for local
review, or add the actual app origin to the bucket's CORS configuration.

Previous model credits, opening camera poses, and annotation coordinates do not
carry over to the pack. Hotspot editor drafts use a separate storage namespace
to preserve drafts for the previous models. Pack-specific hotspots and exact
opening poses can be authored after visual review.

Run `npm run test:instrument-pack` to check both the original catalogue and pack
selection, including credit/coordinate isolation. General tests use Vite's
`test` mode with an explicit empty pack URL to check the legacy selection.

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
file sizes, export settings, and pending review status. Creator, source URL,
license, and attribution for this pack remain unverified and must be confirmed
before publication. Asset-specific records in `public/licenses/instrument-pack/`
document each GLB's path, SHA-256, export changes, and source root. Records for
the ten verified uploads include the hosted `assetPath` and `assetUrl`, retaining
the staging path as `localAssetPath`. Unknown rights
fields are `null`, with `verificationStatus: requires-review`; these records do
not grant a license. The snare record has a null `instrumentId` because there is
no dedicated catalogue entry. Existing catalogue attributions must not be
assumed to apply to these files.
