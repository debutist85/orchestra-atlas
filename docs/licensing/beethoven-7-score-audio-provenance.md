# Orchestra Atlas --- Beethoven No. 7 Score & Audio Provenance

**Last verified:** 23 September 2026

This file records the source, licensing, and rendering provenance for
the Beethoven material currently used in the Orchestra Atlas prototype.
It is intended as project documentation, not legal advice.

## Work

-   **Composer:** Ludwig van Beethoven (1770--1827)
-   **Work:** Symphony No. 7 in A major, Op. 92
-   **Primary movement used:** II. Allegretto
-   **Additional movement under consideration/use:** IV. Allegro con
    brio
-   **Composition status:** Public domain

Beethoven died in 1827, so the underlying musical composition is in the
public domain. This does **not** mean that every modern edition, digital
transcription, recording, or sample library associated with the work is
automatically public domain; those layers are documented separately
below.

## Digital score source

The MuseScore score used by Orchestra Atlas comes from the **OpenScore
Orchestra Corpus**, distributed through **Four Score and More**.

The Orchestra Corpus catalogue contains Beethoven's *Symphony No. 7, Op.
92* as four movements and provides direct downloads in MuseScore
(`.mscz`) and compressed MusicXML (`.mxl`) formats, including Movement
2.

**Catalogue:**\
https://fourscoreandmore.org/openscore/orchestra/

**OpenScore collection information:**\
https://fourscoreandmore.org/openscore/

Four Score and More describes the OpenScore collections as carefully
transcribed scores released under the **CC0 1.0 Universal** dedication.
The Orchestra Corpus page identifies the Beethoven Symphony No. 7 files
as part of that collection.

### Digital score license

**License:** Creative Commons CC0 1.0 Universal\
**License text:**\
https://creativecommons.org/publicdomain/zero/1.0/

CC0 is a maximally permissive public-domain dedication. Attribution is
not legally required by CC0, but Orchestra Atlas should retain source
attribution as a matter of provenance, transparency, and good scholarly
practice.

### Recommended score attribution

> Digital score: OpenScore Orchestra Corpus / Four Score and More.
> Beethoven, Symphony No. 7 in A major, Op. 92, II. Allegretto.
> OpenScore transcription released under CC0 1.0 Universal.

## Score modifications for Orchestra Atlas

The OpenScore `.mscz` file is used as the symbolic musical source for
the prototype. Orchestra Atlas may modify a working copy for playback
purposes, including:

-   assigning or correcting MuseSounds instruments;
-   adjusting playback-related dynamics or transitions where necessary;
-   making playback-oriented tempo or interpretation changes;
-   exporting individual instrumental parts;
-   exporting a full-orchestra mix;
-   deriving synchronized activity/intensity data for the interactive
    visualization.

Where practical, the original downloaded OpenScore file should be
retained separately from the modified playback copy so that the upstream
source and project-specific modifications remain distinguishable.

## MuseScore Studio

The score is opened, edited, and rendered with **MuseScore Studio**.

**MuseScore Studio:**\
https://musescore.org/

**MuseScore FAQ --- commercial use:**\
https://musescore.org/en/node/20202

MuseScore's published FAQ states that MuseScore itself does not impose
ownership or licensing restrictions on work made with the application,
including exported audio files and `.mscz` files. This statement
concerns the MuseScore Studio software; rights in the underlying
composition, score source, fonts, sounds, plugins, and other third-party
content still need to be considered separately.

**MuseScore file-export documentation:**\
https://musescore.org/en/print/book/export/html/329674

MuseScore Studio can export individual selected parts as audio. For
Orchestra Atlas, WAV exports are retained as master/source audio and
web-delivery files are derived from those masters.

## MuseSounds Core

The orchestral playback is rendered using **MuseSounds Core**
instruments distributed through MuseHub.

**MuseSounds Core:**\
https://www.musehub.com/bundle/musesounds-core

MuseHub describes MuseSounds Core as a free, complete playback bundle
for MuseScore Studio, including orchestral strings, woodwinds, brass,
percussion, and other instruments. Its product page describes it as a
collection for composing, arranging, and sharing music.

Relevant individual MuseSounds pages also explicitly describe the Muse
Group libraries as free to use in compositions. For example:

-   **Muse Strings:** https://www.musehub.com/muse-sounds/muse-strings
-   **Muse Brass:** https://www.musehub.com/muse-sounds/muse-brass
-   **Free MuseSounds catalogue:**
    https://www.musehub.com/free-musesounds

MuseSounds are playback instruments based on recorded sample content.
MuseHub explains that the MuseSounds engine uses databases of recordings
to reproduce the written score.

**What are MuseSounds?:**\
https://support.musehub.com/en/articles/15070615-what-are-musesounds

## MuseSounds licensing and rendered audio

MuseHub's current documentation for MuseSounds Pro explicitly says its
libraries may be used in professional projects, including commercial
audio for film, television, broadcast, radio, video games, online
streaming, and other media, while individual samples may not be
redistributed or resold on their own.

**MuseSounds Pro FAQ:**\
https://support.musehub.com/en/articles/15070610-musesounds-pro-frequently-asked-questions

For the free MuseSounds Core libraries used by this project, the
official product pages describe the libraries as free and intended for
use in compositions. Orchestra Atlas uses them to **render a musical
performance from a score**; it does not extract, package, sell, or
redistribute the underlying MuseSounds sample library.

However, MuseHub's general Terms of Service make an important
distinction: content obtained through MuseHub is governed by the
applicable **End User Licence Agreement (EULA)** supplied by MuseHub or
the relevant content provider, and individual products may have
additional terms.

**MuseHub Terms of Service:**\
https://www.musehub.com/terms

Accordingly, the project should **not describe its rendered WAV/Opus
audio as CC0 merely because the OpenScore score is CC0**. The score
license and playback-library terms are separate rights layers.

If the project later replaces a MuseSounds Core instrument with a
third-party, premium, or partner MuseSounds library, the EULA for that
specific library should be reviewed before publishing the resulting
audio.

## Orchestra Atlas audio assets

The current audio pipeline is approximately:

``` text
Public-domain Beethoven composition
        ↓
OpenScore Orchestra Corpus digital transcription (CC0)
        ↓
Orchestra Atlas playback edits / instrument assignments
        ↓
MuseScore Studio
        ↓
MuseSounds Core playback instruments
        ↓
Project-generated WAV masters
        ↓
Opus full-orchestra mix + synchronized Opus stem chunks
        ↓
Interactive Orchestra Atlas web playback
```

The resulting audio is therefore best described as a **project-generated
rendering of a public-domain composition from a CC0 digital score,
rendered using MuseSounds playback instruments**.

It should not be described as:

-   an original Beethoven recording;
-   a public-domain historical recording;
-   an OpenScore audio recording;
-   CC0 audio solely because the score is CC0; or
-   a redistribution of MuseSounds samples.

## Recommended rights metadata

``` yaml
work:
  composer: "Ludwig van Beethoven"
  title: "Symphony No. 7 in A major, Op. 92"
  movement: "II. Allegretto"
  composition_status: "Public domain"

score:
  source: "OpenScore Orchestra Corpus"
  publisher_or_host: "Four Score and More"
  format: "MuseScore (.mscz)"
  license: "CC0 1.0 Universal"
  source_url: "https://fourscoreandmore.org/openscore/orchestra/"
  license_url: "https://creativecommons.org/publicdomain/zero/1.0/"

rendering:
  application: "MuseScore Studio"
  playback_library: "MuseSounds Core"
  playback_provider: "Muse Group / MuseHub"
  musesounds_url: "https://www.musehub.com/bundle/musesounds-core"
  musehub_terms_url: "https://www.musehub.com/terms"
  description: "Project-generated rendering; MuseSounds source samples are not redistributed."

audio:
  master_format: "WAV"
  delivery_format: "Opus"
  license_note: "Do not label the rendered audio CC0 solely on the basis of the OpenScore score license."
```

## Suggested public-facing credit

A concise credit suitable for the Orchestra Atlas interface:

> **Ludwig van Beethoven --- Symphony No. 7 in A major, Op. 92: II.
> Allegretto**\
> Public-domain composition. Digital score from the OpenScore Orchestra
> Corpus / Four Score and More (CC0 1.0 Universal). Audio rendered for
> Orchestra Atlas in MuseScore Studio using MuseSounds Core.

For a credits or legal page, link **OpenScore Orchestra Corpus**, **CC0
1.0**, and **MuseSounds Core**.

## Rights layers

For Orchestra Atlas, these rights should continue to be tracked
independently:

  -----------------------------------------------------------------------
  Layer                               Current status / source
  ----------------------------------- -----------------------------------
  Musical composition                 Beethoven; public domain

  Digital score/transcription         OpenScore Orchestra Corpus; CC0 1.0
                                      Universal

  Project score modifications         Orchestra Atlas working copy

  Rendering software                  MuseScore Studio

  Playback/sample library             MuseSounds Core; subject to
                                      applicable MuseHub/content EULA

  Rendered WAV masters                Project-generated audio; do not
                                      automatically label CC0

  Derived Opus files/chunks           Derived from project WAV renders;
                                      same rights considerations as
                                      rendered audio

  Activity/intensity data             Project-generated analytical data
                                      derived from the score/audio
                                      pipeline
  -----------------------------------------------------------------------

Keeping these layers separate prevents the common mistake of treating a
public-domain composition or CC0 score as proof that every associated
recording or sample-based render has the same status.

## Project practice / safeguards

For the current prototype:

1.  Retain the original OpenScore `.mscz` download separately from the
    modified playback version.
2.  Record the OpenScore source URL and CC0 license in repertoire
    metadata.
3.  Record MuseScore Studio and MuseSounds Core as the rendering tools.
4.  Keep WAV masters as internal source assets and derive web Opus
    assets from them.
5.  Do not redistribute MuseSounds sample-library files or attempt to
    expose/extract individual underlying samples.
6.  Do not mark rendered stems or the full-orchestra render as `CC0`
    merely because the score is CC0.
7.  Re-check the applicable EULA before introducing any third-party or
    premium MuseSounds library.
8.  Re-check these terms before a materially different commercial
    release, since online terms and product EULAs can change.

## References

-   OpenScore Orchestra Corpus ---
    https://fourscoreandmore.org/openscore/orchestra/
-   About the OpenScore collections ---
    https://fourscoreandmore.org/openscore/
-   Four Score and More --- https://fourscoreandmore.org/
-   CC0 1.0 Universal ---
    https://creativecommons.org/publicdomain/zero/1.0/
-   MuseScore Studio --- https://musescore.org/
-   MuseScore commercial-use FAQ --- https://musescore.org/en/node/20202
-   MuseScore file export documentation ---
    https://musescore.org/en/print/book/export/html/329674
-   MuseSounds Core --- https://www.musehub.com/bundle/musesounds-core
-   Muse Strings --- https://www.musehub.com/muse-sounds/muse-strings
-   Muse Brass --- https://www.musehub.com/muse-sounds/muse-brass
-   Free MuseSounds --- https://www.musehub.com/free-musesounds
-   What are MuseSounds? ---
    https://support.musehub.com/en/articles/15070615-what-are-musesounds
-   MuseSounds Pro FAQ ---
    https://support.musehub.com/en/articles/15070610-musesounds-pro-frequently-asked-questions
-   MuseHub Terms of Service --- https://www.musehub.com/terms

------------------------------------------------------------------------

**Documentation note:** This record reflects publicly available source
and licensing information checked on 23 September 2026. Product terms
and EULAs can change; the applicable terms should be re-checked before a
materially different distribution or commercial use.
