import type { OrchestraInstrument } from '../orchestra-map/config'
import type { Technique } from './technique'

// Draft musical content; GLB anchor names below are temporary UI test positions,
// not anatomical correspondences. Replace these bindings when real models arrive.
type PreviewPart = { label: string; description: string; techniques: Technique[]; techniqueIds?: string[] }
type PreviewContent = { summary: string; sourceUrl: string; reviewStatus: 'draft'; parts: Record<string, PreviewPart> }

export const previewInstrumentContent: Partial<Record<OrchestraInstrument, PreviewContent>> = {
  "viola": {
    "summary": "The viola is a bowed string instrument larger and lower-pitched than the violin. Its warm middle register connects the upper and lower strings.",
    "sourceUrl": "https://www.vsl.co.at/academy/strings/viola",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Strings",
        "description": "The viola’s strings vibrate when bowed or plucked; the bridge passes those vibrations into the body.",
        "techniques": [
          {
            "id": "preview-viola-0",
            "title": "Pizzicato",
            "description": "The player plucks a string with a finger rather than drawing the bow across it.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Fingerboard",
        "description": "Pressing a string against the fingerboard shortens its vibrating length and changes its pitch.",
        "techniques": [
          {
            "id": "preview-viola-1",
            "title": "Vibrato",
            "description": "The player rocks the stopping finger to create a small fluctuation in pitch.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Bow": {
        "label": "Bow",
        "description": "The bow’s hair sets the strings into vibration through friction.",
        "techniques": [
          {
            "id": "preview-viola-2",
            "title": "Tremolo",
            "description": "Rapid repeated bow strokes create a sustained, trembling texture.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "cello": {
    "summary": "The cello is a low string instrument played upright between the knees. Its broad range supports both bass lines and expressive melodies.",
    "sourceUrl": "https://www.vsl.co.at/academy/strings/cello",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Strings",
        "description": "The cello’s strings vibrate when bowed or plucked; the bridge passes those vibrations into the body.",
        "techniques": [
          {
            "id": "preview-cello-0",
            "title": "Pizzicato",
            "description": "The player plucks a string with a finger rather than drawing the bow across it.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Fingerboard",
        "description": "Pressing a string against the fingerboard shortens its vibrating length and changes its pitch.",
        "techniques": [
          {
            "id": "preview-cello-1",
            "title": "Vibrato",
            "description": "The player rocks the stopping finger to create a small fluctuation in pitch.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Bow": {
        "label": "Bow",
        "description": "The bow’s hair sets the strings into vibration through friction.",
        "techniques": [
          {
            "id": "preview-cello-2",
            "title": "Tremolo",
            "description": "Rapid repeated bow strokes create a sustained, trembling texture.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "doubleBass": {
    "summary": "The double bass is the largest and lowest-pitched member of the orchestral string family. It provides a foundation for the ensemble, played with a bow or plucked.",
    "sourceUrl": "https://www.vsl.co.at/academy/strings/double-bass",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Strings",
        "description": "The double bass’s strings vibrate when bowed or plucked; the bridge passes those vibrations into the body.",
        "techniques": [
          {
            "id": "preview-doubleBass-0",
            "title": "Pizzicato",
            "description": "The player plucks a string with a finger rather than drawing the bow across it.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Fingerboard",
        "description": "Pressing a string against the fingerboard shortens its vibrating length and changes its pitch.",
        "techniques": [
          {
            "id": "preview-doubleBass-1",
            "title": "Vibrato",
            "description": "The player rocks the stopping finger to create a small fluctuation in pitch.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Bow": {
        "label": "Bow",
        "description": "The bow’s hair sets the strings into vibration through friction.",
        "techniques": [
          {
            "id": "preview-doubleBass-2",
            "title": "Tremolo",
            "description": "Rapid repeated bow strokes create a sustained, trembling texture.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "flute": {
    "summary": "The flute produces sound when the player blows across an opening in its headjoint. Its clear tone can move from a soft low register to a bright upper register.",
    "sourceUrl": "https://www.vsl.co.at/academy/woodwinds/concert-flute",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Embouchure hole",
        "description": "The air jet meets the edge of the embouchure hole, setting the air inside the flute into vibration.",
        "techniques": [
          {
            "id": "preview-flute-0",
            "title": "Flutter tonguing",
            "description": "Rolling the tongue while blowing creates a rapid flutter in the sound.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Keys",
        "description": "Keys open and close tone holes, changing the effective length of the vibrating air column.",
        "techniques": [
          {
            "id": "preview-flute-1",
            "title": "Trill",
            "description": "The player alternates rapidly between two neighboring notes.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "oboe": {
    "summary": "The oboe is a woodwind instrument sounded by a double reed. Its focused, penetrating tone makes it a distinctive melodic voice.",
    "sourceUrl": "https://www.vsl.co.at/academy/woodwinds/oboe",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Double reed",
        "description": "Two thin blades of cane vibrate against one another as air passes between them.",
        "techniques": [
          {
            "id": "preview-oboe-0",
            "title": "Tonguing",
            "description": "The tongue interrupts the air at the reed to give notes a distinct beginning.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Keys and tone holes",
        "description": "Opening and closing tone holes changes the effective length of the vibrating air column.",
        "techniques": [
          {
            "id": "preview-oboe-1",
            "title": "Trill",
            "description": "The player alternates rapidly between two neighboring notes.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "clarinet": {
    "summary": "The clarinet uses a single reed attached to a mouthpiece. Its wide range spans a dark low register and a brighter upper register.",
    "sourceUrl": "https://www.vsl.co.at/academy/woodwinds/clarinet",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Reed and mouthpiece",
        "description": "A single cane reed vibrates against the mouthpiece to excite the air inside the instrument.",
        "techniques": [
          {
            "id": "preview-clarinet-0",
            "title": "Tonguing",
            "description": "The tongue interrupts the air at the reed to give notes a distinct beginning.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Keys and tone holes",
        "description": "Opening and closing tone holes changes the effective length of the vibrating air column.",
        "techniques": [
          {
            "id": "preview-clarinet-1",
            "title": "Trill",
            "description": "The player alternates rapidly between two neighboring notes.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "bassoon": {
    "summary": "The bassoon is a low woodwind instrument played with a double reed. Its folded tube supports a wide range, from deep bass notes to expressive melodies.",
    "sourceUrl": "https://www.vsl.co.at/academy/woodwinds/bassoon",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Reed and bocal",
        "description": "The double reed fits onto a curved metal tube called the bocal, which connects it to the instrument.",
        "techniques": [
          {
            "id": "preview-bassoon-0",
            "title": "Tonguing",
            "description": "The tongue interrupts the air at the reed to give notes a distinct beginning.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Keys and tone holes",
        "description": "Opening and closing tone holes changes the effective length of the vibrating air column.",
        "techniques": [
          {
            "id": "preview-bassoon-1",
            "title": "Trill",
            "description": "The player alternates rapidly between two neighboring notes.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "horn": {
    "summary": "The horn is a brass instrument with coiled tubing and a wide bell. Its rounded tone can blend with the orchestra or emerge in prominent calls.",
    "sourceUrl": "https://www.vsl.co.at/academy/brass/horn-f",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Mouthpiece",
        "description": "The player’s lips vibrate against the mouthpiece, exciting the air inside the tubing.",
        "techniques": [
          {
            "id": "preview-horn-0",
            "title": "Lip slur",
            "description": "The player moves between natural harmonics without a fresh tongue attack.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Valves",
        "description": "Valves route air through additional tubing to lower the available pitches.",
        "techniques": [
          {
            "id": "preview-horn-1",
            "title": "Legato",
            "description": "The player connects successive notes smoothly while coordinating airflow and valve changes.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "trumpet": {
    "summary": "The trumpet is a brass instrument sounded by the player’s vibrating lips. Its bright, projecting tone gives clarity to melodies and rhythmic figures.",
    "sourceUrl": "https://www.vsl.co.at/academy/brass/trumpet-c",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Mouthpiece",
        "description": "The player’s lips vibrate against the mouthpiece, exciting the air inside the tubing.",
        "techniques": [
          {
            "id": "preview-trumpet-0",
            "title": "Lip slur",
            "description": "The player moves between natural harmonics without a fresh tongue attack.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Valves",
        "description": "Valves route air through additional tubing to lower the available pitches.",
        "techniques": [
          {
            "id": "preview-trumpet-1",
            "title": "Legato",
            "description": "The player connects successive notes smoothly while coordinating airflow and valve changes.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "tuba": {
    "summary": "The tuba is the lowest-pitched member of the orchestral brass family. Its broad sound supports the brass section and the ensemble’s bass line.",
    "sourceUrl": "https://www.vsl.co.at/academy/brass/bass-tuba",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Mouthpiece",
        "description": "The player’s lips vibrate against the mouthpiece, exciting the air inside the tubing.",
        "techniques": [
          {
            "id": "preview-tuba-0",
            "title": "Lip slur",
            "description": "The player moves between natural harmonics without a fresh tongue attack.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Valves",
        "description": "Valves route air through additional tubing to lower the available pitches.",
        "techniques": [
          {
            "id": "preview-tuba-1",
            "title": "Legato",
            "description": "The player connects successive notes smoothly while coordinating airflow and valve changes.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "trombone": {
    "summary": "The trombone is a brass instrument whose slide changes the length of its tubing. Its sound ranges from a blended, mellow voice to a powerful brass presence.",
    "sourceUrl": "https://www.vsl.co.at/academy/brass/tenor-trombone",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Mouthpiece",
        "description": "The player’s vibrating lips set the air column inside the trombone into motion.",
        "techniques": [
          {
            "id": "preview-trombone-0",
            "title": "Tonguing",
            "description": "The tongue shapes the start of each note while the player maintains airflow.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Slide",
        "description": "Extending the slide lengthens the tubing and lowers the available pitches.",
        "techniques": [
          {
            "id": "preview-trombone-1",
            "title": "Glissando",
            "description": "Moving the slide during a sustained sound creates a continuous pitch change within the available slide range.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "harp": {
    "summary": "The orchestral harp has strings that are plucked with the fingers. Foot pedals alter their pitches, allowing changes of key and harmony.",
    "sourceUrl": "https://www.vsl.co.at/academy/strings/harp",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Strings",
        "description": "The player plucks strings of different lengths to produce different pitches.",
        "techniques": [
          {
            "id": "preview-harp-0",
            "title": "Arpeggio",
            "description": "The notes of a chord are plucked one after another.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Pedals",
        "description": "The pedals change string pitches by altering their effective vibrating lengths.",
        "techniques": [
          {
            "id": "preview-harp-1",
            "title": "Glissando",
            "description": "The player sweeps across successive strings; the pedal settings determine the notes heard.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "celesta": {
    "summary": "The celesta is played from a keyboard that operates hammers striking metal plates. Its soft, bell-like tone adds a delicate shimmer to orchestral textures.",
    "sourceUrl": "https://www.vsl.co.at/academy/percussion/celesta",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Metal plates and resonators",
        "description": "Hammers strike tuned metal plates, with resonators reinforcing the sound.",
        "techniques": [
          {
            "id": "preview-celesta-0",
            "title": "Arpeggio",
            "description": "Playing the notes of a chord in succession creates a gently unfolding texture.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Keyboard",
        "description": "Each key operates a hammer mechanism, allowing the player to control the attack of a note.",
        "techniques": [
          {
            "id": "preview-celesta-1",
            "title": "Scales",
            "description": "Successive steps through a scale create flowing lines across the keyboard.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "pitchedPercussion": {
    "summary": "Pitched percussion includes instruments such as the xylophone, marimba, and glockenspiel. Their tuned bars produce distinct notes when struck with mallets.",
    "sourceUrl": "https://philharmonia.co.uk/resources/instruments/percussion/",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Tuned bars",
        "description": "Bars of different dimensions produce different pitches when struck.",
        "techniques": [
          {
            "id": "preview-pitchedPercussion-0",
            "title": "Single strokes",
            "description": "A mallet strike gives a note a clear beginning; its sound depends on the instrument and mallet.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Mallets",
        "description": "Mallet material and hardness influence the attack and tone of the struck bar.",
        "techniques": [
          {
            "id": "preview-pitchedPercussion-1",
            "title": "Alternating strokes",
            "description": "Alternating hands lets the player perform a succession of notes.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "unpitchedPercussion": {
    "summary": "Unpitched percussion includes drums, cymbals, and other instruments without a single clearly defined musical pitch. They shape rhythm, accents, and orchestral color.",
    "sourceUrl": "https://philharmonia.co.uk/resources/instruments/percussion/",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Bridge": {
        "label": "Drumhead",
        "description": "On a drum, a stretched membrane vibrates when struck.",
        "techniques": [
          {
            "id": "preview-unpitchedPercussion-0",
            "title": "Single stroke",
            "description": "Striking the drumhead with a stick or mallet produces an individual attack.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      },
      "Anchor_Fingerboard": {
        "label": "Cymbals",
        "description": "Cymbals are metal plates that vibrate when struck or brought together.",
        "techniques": [
          {
            "id": "preview-unpitchedPercussion-1",
            "title": "Cymbal crash",
            "description": "Bringing a pair of clash cymbals together creates a broad, ringing accent.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  },
  "timpani": {
    "summary": "Timpani are large, bowl-shaped drums played with mallets and tuned to distinct pitches using foot pedals. Their deep, resonant sound adds weight, tension, and drama to the orchestra.",
    "sourceUrl": "https://www.vsl.co.at/academy/percussion/timpani",
    "reviewStatus": "draft",
    "parts": {
      "Anchor_Chinrest": {
        "label": "Drumhead",
        "description": "A stretched drumhead vibrates when struck with a mallet; its tension helps determine the pitch.",
        "techniques": [],
        "techniqueIds": [
          "stroke",
          "tremolo"
        ]
      },
      "Anchor_Bow": {
        "label": "Tuning pedal",
        "description": "The pedal changes the drumhead’s tension, letting the player adjust its pitch.",
        "techniques": [
          {
            "id": "preview-timpani-1",
            "title": "Pedal glissando",
            "description": "Moving the pedal while the drum resonates produces a sliding change of pitch.",
            "demonstrationIds": [
              "prototype-violin-video"
            ]
          }
        ]
      }
    }
  }
}

export function previewTechniqueById(id: string): Technique | undefined {
  return Object.values(previewInstrumentContent).flatMap(content => Object.values(content.parts)).flatMap(part => part.techniques).find(technique => technique.id === id)
}
