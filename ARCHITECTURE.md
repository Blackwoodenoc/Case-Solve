# 🏗️ Архитектура Shorts DNA Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             VideoMind AI                                 │
│                     Deep Video Analytics Platform                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              USER FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

    1. Upload Video File (15-60 sec)
              │
              ▼
    2. Click "🧬 Shorts DNA Analysis"
              │
              ▼
    3. AI Processing (Gemini 2.5 Flash)
              │
              ├─→ Extract Transcript (audio)
              ├─→ Analyze Visual Frames
              ├─→ Detect Structure & Patterns
              └─→ Generate JSON Passport
              │
              ▼
    4. Interactive Style Passport Viewer
              │
              ├─→ Explore Sections
              ├─→ Copy JSON
              └─→ Download JSON
              │
              ▼
    5. Use Passport for Content Generation


┌─────────────────────────────────────────────────────────────────────────┐
│                          COMPONENT STRUCTURE                             │
└─────────────────────────────────────────────────────────────────────────┘

App.tsx
├── VideoPlayer.tsx
│   ├── File Upload
│   └── Remote URL Input
│
├── Intelligence Toolbox
│   ├── Summarize Content
│   ├── Deep Analysis
│   ├── Technical Extract
│   └── 🧬 Shorts DNA Analysis ★ NEW
│
└── AnalysisPanel.tsx
    ├── Standard Analysis (Markdown)
    └── StylePassportViewer.tsx ★ NEW
        ├── Summary Section
        ├── Tone of Voice Section
        ├── Speech Pace Section
        ├── Structure Timeline Section
        ├── Retention Patterns Section
        ├── Visual Style Section
        ├── Do/Don't Section
        └── Generation Rules Section


┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Video File  │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     geminiService.analyzeShortsDNA()                     │
│                                                                          │
│  1. fileToGenerativePart(videoFile)                                     │
│     └─→ Convert to base64                                               │
│                                                                          │
│  2. Build Prompt                                                        │
│     ├─→ Transcript instructions                                         │
│     ├─→ Visual analysis instructions                                    │
│     ├─→ Structure analysis requirements                                 │
│     ├─→ JSON schema definition                                          │
│     └─→ Validation checks                                               │
│                                                                          │
│  3. Gemini 2.5 Flash API Call                                           │
│     ├─→ Model: gemini-2.5-flash-native-audio-preview-09-2025           │
│     ├─→ Temperature: 0.3 (for JSON stability)                           │
│     └─→ Contents: [videoPart, promptPart]                               │
│                                                                          │
│  4. Process Response                                                    │
│     ├─→ Strip markdown wrappers (```json)                               │
│     ├─→ Parse JSON                                                      │
│     └─→ Validate structure                                              │
│                                                                          │
│  5. Return AnalysisResponse                                             │
│     ├─→ text: "✅ Паспорт стиля успешно сгенерирован"                   │
│     └─→ stylePassport: StylePassport object                             │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          AnalysisState (React State)                     │
│                                                                          │
│  {                                                                      │
│    isLoading: false,                                                    │
│    result: "✅ Паспорт стиля успешно сгенерирован",                     │
│    error: null,                                                         │
│    stylePassport: {                                                     │
│      language: "ru",                                                    │
│      style_passport_version: "1.0",                                     │
│      overall_summary: "...",                                            │
│      tone_of_voice: { ... },                                            │
│      speech_pace: { ... },                                              │
│      structure: [ ... ],                                                │
│      retention_patterns: [ ... ],                                       │
│      visual_style: { ... },                                             │
│      do_dont: { ... },                                                  │
│      generation_rules: [ ... ]                                          │
│    }                                                                    │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       StylePassportViewer.tsx                            │
│                                                                          │
│  Renders interactive UI with:                                           │
│  ├─→ Collapsible sections                                               │
│  ├─→ Color-coded badges                                                 │
│  ├─→ Progress bars (formality level)                                    │
│  ├─→ Timeline visualization (structure)                                 │
│  ├─→ Copy JSON button                                                   │
│  └─→ Download JSON button                                               │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                          TYPE HIERARCHY                                  │
└─────────────────────────────────────────────────────────────────────────┘

StylePassport
├── language: string
├── style_passport_version: string
├── overall_summary: string
│
├── tone_of_voice: ToneOfVoice
│   ├── archetype: string
│   ├── mood: string[]
│   ├── formality_level_0_10: number
│   ├── direct_address_patterns: string[]
│   ├── signature_phrases: string[]
│   └── filler_words: string[]
│
├── speech_pace: SpeechPace
│   ├── wpm_estimate: number
│   ├── pace_label: "low" | "medium" | "high"
│   └── pause_style: string
│
├── structure: VideoStructurePart[]
│   └── VideoStructurePart
│       ├── part: "hook" | "setup" | "main" | "climax" | "cta"
│       ├── t_start: string
│       ├── t_end: string
│       ├── what_happens: string
│       └── why_it_holds: string[]
│
├── retention_patterns: RetentionPattern[]
│   └── RetentionPattern
│       ├── pattern: string
│       ├── how_it_looks_in_text: string
│       ├── where_in_video: string[]
│       └── reuse_rule: string
│
├── visual_style: VisualStyle
│   ├── editing: string
│   ├── shot_types: string[]
│   ├── on_screen_text_style: string
│   └── typical_actions: string[]
│
├── do_dont: DoAndDont
│   ├── do: string[]
│   └── dont: string[]
│
└── generation_rules: string[]


┌─────────────────────────────────────────────────────────────────────────┐
│                       COLOR CODING SCHEME                                │
└─────────────────────────────────────────────────────────────────────────┘

🔵 Blue     → Information, general data, metadata
🟣 Purple   → Tone of Voice, archetype, style passport branding
🟢 Green    → Structure, positive indicators, checkmarks
🟡 Amber    → Retention patterns, warnings, highlights
🔴 Red      → Errors, don'ts, negative indicators
🔷 Cyan     → Visual style, technical details
🟠 Orange   → Speech pace indicators


┌─────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING                                   │
└─────────────────────────────────────────────────────────────────────────┘

Try
├─→ analyzeShortsDNA()
│   ├─→ Gemini API Call
│   │   ├─→ Success → Parse JSON
│   │   │   ├─→ Valid JSON → Return passport
│   │   │   └─→ Invalid JSON → Return raw text with warning
│   │   │
│   │   └─→ Failure → Throw error
│   │       ├─→ API_KEY_INVALID → setHasApiKey(false)
│   │       ├─→ Safety filter → "Content flagged"
│   │       └─→ Other → Show error message
│
└─→ Catch
    ├─→ Update AnalysisState.error
    └─→ Display in AnalysisPanel


┌─────────────────────────────────────────────────────────────────────────┐
│                     FILE STRUCTURE OVERVIEW                              │
└─────────────────────────────────────────────────────────────────────────┘

Wub/
├── components/
│   ├── VideoPlayer.tsx           (existing)
│   ├── AnalysisPanel.tsx         (modified)
│   └── StylePassportViewer.tsx   (★ NEW)
│
├── services/
│   └── geminiService.ts          (modified)
│       └── analyzeShortsDNA()    (★ NEW function)
│
├── types.ts                      (modified)
│   ├── StylePassport             (★ NEW)
│   ├── ToneOfVoice               (★ NEW)
│   ├── SpeechPace                (★ NEW)
│   ├── VideoStructurePart        (★ NEW)
│   ├── RetentionPattern          (★ NEW)
│   ├── VisualStyle               (★ NEW)
│   └── DoAndDont                 (★ NEW)
│
├── App.tsx                       (modified)
│
├── README.md                     (modified)
├── SHORTS_DNA_INTEGRATION.md    (★ NEW)
├── EXAMPLE_USAGE.md             (★ NEW)
└── COMPLETION_REPORT.md         (★ NEW)


┌─────────────────────────────────────────────────────────────────────────┐
│                       INTEGRATION POINTS                                 │
└─────────────────────────────────────────────────────────────────────────┘

1. Button Click (App.tsx)
   └─→ runAnalysis(AnalysisType.SHORTS_DNA)

2. Analysis Dispatch
   └─→ analyzeShortsDNA(videoFile)

3. State Update
   └─→ setAnalysis({ stylePassport: {...} })

4. Conditional Render (AnalysisPanel.tsx)
   └─→ {stylePassport ? <StylePassportViewer /> : <Markdown />}

5. Interactive UI
   └─→ User explores sections, copies/downloads JSON


┌─────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT NOTES                                 │
└─────────────────────────────────────────────────────────────────────────┘

✅ No breaking changes
✅ Backward compatible
✅ Zero linter errors
✅ Type-safe
✅ Production-ready

Requirements:
- Gemini API Key (paid GCP account)
- Node.js + npm
- Modern browser (for ES6+ features)

Build:
  npm run build

Deploy:
  Follow AI Studio deployment guide
```

