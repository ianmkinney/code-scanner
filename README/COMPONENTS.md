---
tags: [components, architecture]
---

# Components

## Scanner
High-level container that renders the puck UI, viewfinder, controls, and result section.

Pseudo code:
```md
state: isScanning, scannedCode, banner, status, attemptCount, mpLabel
refs: viewportDiv, videoEl, mediaStream, interval

onStartCamera():
  - check https or localhost
  - choose back camera
  - create <video> in viewport
  - play stream
  - start setInterval(1200ms):
      qr = readQrInViewfinderOnce()
      if qr:
        urlCode = extractCodeFromURL(qr.text)
        printed = ocrUnderViewfinderOnce()
        if printed -> processFoundCode(printed)
        else if urlCode -> processFoundCode(urlCode)
      else:
        printed = ocrUnderViewfinderOnce()
        if printed -> processFoundCode(printed)

processFoundCode(code):
  - stopCamera()
  - set scannedCode
  - copy to clipboard
  - play success beep

onStopCamera():
  - stop tracks
  - clear interval

onCapture():
  - single ocrUnderViewfinderOnce -> processFoundCode if found
```

### Helpers
- `isURL(text)` → heuristic + URL() constructor
- `isValidProductCode(code)` → length 6–25, alnum, not all digits, not common words
- `extractCodeFromURL(url)` → last/prev path segment or `?code=...`
- `readQrInViewfinderOnce()` → crop from video → `jsqr`
- `ocrUnderViewfinderOnce()` → crop under viewfinder, binarize → `tesseract.js`

### Styling
All CSS in `src/app/globals.css` mirrors `index.html` (container, puck, viewfinder, buttons, feedback, results, etc.). Color is configurable via `--can-green`.

### Files
- `src/components/Scanner.tsx`
- `src/app/globals.css`

### External libs
- [`jsqr`](https://www.npmjs.com/package/jsqr)
- [`tesseract.js`](https://www.npmjs.com/package/tesseract.js)

