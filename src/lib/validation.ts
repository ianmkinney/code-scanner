export const isValidProductCode = (code: string): boolean => {
  const clean = code.trim().replace(/\s/g, "");
  const hasDigit = /\d/.test(clean);
  
  // Basic length check
  if (clean.length < 6 || clean.length > 25) return false;
  
  // Must be alphanumeric only
  if (!/^[A-Za-z0-9]+$/.test(clean)) return false;
  
  // Cannot be all numbers
  if (/^\d+$/.test(clean)) return false;
  
  // Must have at least one letter
  if (!/[A-Za-z]/.test(clean)) return false;
  
  // Check against common non-code words that might be detected by OCR (case-insensitive)
  const common = [
    // Product/package related words
    "CODE", "PRODUCT", "ITEM", "SKU", "BARCODE", "SCAN", "ENTER", "REWARDS", "ZYN",
    "REWARD", "POINTS", "SCANNING", "DETECTED", "FOUND", "SUCCESS", "ERROR", "INVALID",
    "VALID", "CHECK", "VERIFY", "CONFIRM", "ACCEPT", "REJECT", "CANCEL", "RETRY",
    "AGAIN", "NEXT", "PREVIOUS", "BACK", "FORWARD", "CONTINUE", "STOP", "START",
    "BEGIN", "END", "FINISH", "COMPLETE", "DONE", "READY", "WAIT", "LOADING",
    "PROCESSING", "SCANNED", "RECOGNIZED", "IDENTIFIED", "LOCATED", "POSITIONED",
    "ALIGNED", "CENTERED", "FOCUSED", "CLEAR", "BLURRY", "DARK", "LIGHT", "BRIGHT",
    "DIM", "VISIBLE", "HIDDEN", "SHOWN", "DISPLAYED", "PRINTED", "TEXT", "LABEL",
    "TAG", "STICKER", "MARKER", "SIGN", "SYMBOL", "ICON", "IMAGE", "PICTURE",
    "PHOTO", "GRAPHIC", "LOGO", "BRAND", "COMPANY", "MANUFACTURER", "MAKER",
    "CREATOR", "PRODUCER", "SUPPLIER", "VENDOR", "DISTRIBUTOR", "RETAILER",
    "STORE", "SHOP", "MARKET", "PLACE", "LOCATION", "ADDRESS", "SITE", "WEB",
    "ONLINE", "DIGITAL", "VIRTUAL", "REMOTE", "LOCAL", "GLOBAL", "WORLDWIDE",
    "INTERNATIONAL", "NATIONAL", "REGIONAL", "CITY", "STATE", "COUNTRY", "NATION",
    "WORLD", "EARTH", "PLANET", "UNIVERSE", "SPACE", "TIME", "DATE", "YEAR",
    "MONTH", "DAY", "HOUR", "MINUTE", "SECOND", "MOMENT", "INSTANT", "NOW",
    "TODAY", "YESTERDAY", "TOMORROW", "FUTURE", "PAST", "PRESENT", "CURRENT",
    "LATEST", "NEWEST", "OLDEST", "FIRST", "LAST", "BEFORE", "AFTER", "EARLY",
    "LATE", "SOON", "LATER", "ONCE", "TWICE", "THRICE", "MULTIPLE", "SINGLE",
    "DOUBLE", "TRIPLE", "QUAD", "QUINT", "HEX", "OCT", "DEC", "BIN", "OCTAL",
    "DECIMAL", "BINARY", "HEXADECIMAL", "BASE", "RADIX", "DIGIT", "NUMBER",
    "NUMERIC", "ALPHANUMERIC", "ALPHABETIC", "LETTER", "CHARACTER", "SYMBOL",
    "SIGN", "MARK", "DOT", "DASH", "UNDERSCORE", "HYPHEN", "SLASH", "BACKSLASH",
    "PIPE", "TILDE", "GRAVE", "ACUTE", "CIRCUMFLEX", "DIAERESIS", "CEDILLA",
    "RING", "CARON", "GAMMA", "BETA", "ALPHA", "DELTA", "EPSILON", "ZETA",
    "ETA", "THETA", "IOTA", "KAPPA", "LAMBDA", "MU", "NU", "XI", "OMICRON",
    "PI", "RHO", "SIGMA", "TAU", "UPSILON", "PHI", "CHI", "PSI", "OMEGA",
    
    // Common product label words (from the error scans)
    "INGREDIENTS", "INGREDIENT", "CONTAINS", "WARNING", "CAUTION", "NOTICE",
    "INSTRUCTIONS", "DIRECTIONS", "USAGE", "SERVING", "SIZE", "WEIGHT",
    "VOLUME", "CAPACITY", "CONTENT", "NET", "GROSS", "TARE", "BATCH",
    "LOT", "EXPIRES", "EXPIRY", "BEST", "BEFORE", "SELL", "MANUFACTURED",
    "PACKAGED", "DISTRIBUTED", "IMPORTED", "EXPORTED", "ORIGIN", "COUNTRY",
    "MADE", "PRODUCED", "ASSEMBLED", "QUALITY", "STANDARD", "CERTIFIED",
    "APPROVED", "TESTED", "INSPECTED", "GRADE", "TYPE", "STYLE", "VARIETY",
    "FLAVOR", "FLAVOUR", "TASTE", "AROMA", "SCENT", "FRAGRANCE", "ODOR",
    "COLOR", "COLOUR", "SHADE", "HUE", "TONE", "TINT", "PIGMENT", "DYE",
    
    // Common OCR error words and retry patterns
    "RETRIAL", "RETRY", "AGAIN", "FAILED", "MISSED", "SKIPPED", "IGNORED",
    "BLOCKED", "DENIED", "REFUSED", "REJECTED", "DECLINED", "ABORTED",
    "CANCELLED", "STOPPED", "HALTED", "PAUSED", "INTERRUPTED", "BROKEN",
    "CORRUPTED", "DAMAGED", "DEFECTIVE", "FAULTY", "INCOMPLETE", "PARTIAL",
    "FRAGMENTED", "SPLIT", "DIVIDED", "SEPARATED", "ISOLATED", "ALONE",
    "SINGLE", "DOUBLE", "TRIPLE", "MULTIPLE", "SEVERAL", "MANY", "FEW",
    "SOME", "ALL", "NONE", "EMPTY", "FULL", "COMPLETE", "TOTAL", "SUM",
    "ADD", "PLUS", "MINUS", "SUBTRACT", "DIVIDE", "MULTIPLY", "EQUALS",
    "RESULT", "ANSWER", "SOLUTION", "RESPONSE", "REPLY", "RETURN", "BACK",
    
    // Common product categories that might appear on labels
    "NICOTINE", "TOBACCO", "SMOKE", "SMOKING", "CIGARETTE", "CIGAR",
    "PIPE", "CHEW", "CHEWING", "DIP", "DIPPING", "SNUFF", "SNUS",
    "POUCH", "POUCHES", "CAN", "CANS", "CONTAINER", "PACKAGE", "PACKAGING",
    "WRAPPER", "WRAPPING", "SEAL", "SEALED", "UNSEALED", "OPEN", "CLOSED",
    "LOCK", "UNLOCK", "SECURE", "SECURITY", "SAFE", "SAFETY", "PROTECT",
    "PROTECTION", "GUARD", "GUARDING", "SHIELD", "COVER", "COVERING",
    "CASE", "CASING", "SHELL", "SHELLS", "HOUSING", "ENCLOSURE", "BOX",
    "BOXY", "CUBE", "CUBIC", "ROUND", "CIRCULAR", "SQUARE", "RECTANGLE",
    "TRIANGLE", "DIAMOND", "HEXAGON", "OCTAGON", "POLYGON", "SHAPE",
    "FORM", "FIGURE", "PATTERN", "DESIGN", "STYLE", "FASHION", "TREND",
    "MODERN", "CLASSIC", "VINTAGE", "RETRO", "CONTEMPORARY", "TRADITIONAL",
    "CONVENTIONAL", "STANDARD", "BASIC", "ADVANCED", "PREMIUM", "DELUXE",
    "LUXURY", "ECONOMY", "BUDGET", "AFFORDABLE", "EXPENSIVE", "CHEAP",
    "FREE", "PAID", "COST", "PRICE", "VALUE", "WORTH", "BENEFIT", "ADVANTAGE",
    "DISADVANTAGE", "PROBLEM", "ISSUE", "CONCERN", "RISK", "DANGER", "HAZARD",
    "THREAT", "WARNING", "CAUTION", "NOTICE", "ALERT", "ATTENTION", "FOCUS",
    "EMPHASIS", "STRESS", "IMPORTANT", "CRITICAL", "ESSENTIAL", "NECESSARY",
    "REQUIRED", "MANDATORY", "OPTIONAL", "RECOMMENDED", "SUGGESTED", "ADVISED",
    "INSTRUCTED", "DIRECTED", "ORDERED", "COMMANDED", "REQUESTED", "ASKED",
    "QUESTIONED", "INQUIRED", "INVESTIGATED", "RESEARCHED", "STUDIED",
    "ANALYZED", "EXAMINED", "REVIEWED", "EVALUATED", "ASSESSED", "JUDGED",
    "DECIDED", "DETERMINED", "CONCLUDED", "FINISHED", "COMPLETED", "DONE"
  ];
  
  // Check if it's a common word (case-insensitive)
  if (common.includes(clean.toUpperCase())) return false;
  
  // Additional pattern checks for common false positives
  // Avoid codes that look like version numbers (e.g., "1.2.3", "v1.0")
  if (/^v?\d+\.\d+/.test(clean)) return false;
  
  // Avoid codes that look like dates (e.g., "20240101", "2024-01-01")
  if (/^\d{4}[-\/]?\d{2}[-\/]?\d{2}$/.test(clean)) return false;
  
  // Avoid codes that look like times (e.g., "12:34:56", "123456")
  if (/^\d{1,2}[:.]?\d{2}[:.]?\d{2}$/.test(clean)) return false;
  
  // Avoid codes that are too repetitive (e.g., "AAAA1111", "1111AAAA")
  if (/(.)\1{3,}/.test(clean)) return false;
  
  // Avoid codes that are sequential (e.g., "123456", "ABCDEF")
  if (/^(0123456789|1234567890|9876543210|0987654321|ABCDEFGHIJ|abcdefghij|ZYXWVUTSRQ|zyxwvutsrq)$/.test(clean)) return false;
  
  // Avoid codes that are too simple patterns (e.g., "A1A1A1", "1A1A1A")
  if (/^([A-Za-z]\d){2,}$/.test(clean) && clean.length <= 8) return false;
  if (/^(\d[A-Za-z]){2,}$/.test(clean) && clean.length <= 8) return false;
  
  // Avoid codes that look like common OCR errors (mixed case with common words)
  // This catches patterns like "Ingredients", "ingredients", "RETRIAL", etc.
  if (/^[A-Za-z]{3,}$/.test(clean) && clean.length <= 12) {
    const lowerClean = clean.toLowerCase();
    const commonShortWords = [
      "ingredients", "ingredient", "retrial", "retry", "warning", "caution",
      "notice", "contains", "nicotine", "tobacco", "smoke", "smoking",
      "cigarette", "cigar", "pouch", "pouches", "can", "cans", "container",
      "package", "wrapper", "seal", "sealed", "unsealed", "open", "closed",
      "lock", "unlock", "secure", "security", "safe", "safety", "protect",
      "protection", "guard", "guarding", "shield", "cover", "covering",
      "case", "casing", "shell", "shells", "housing", "enclosure", "box",
      "round", "circular", "square", "rectangle", "triangle", "diamond",
      "hexagon", "octagon", "polygon", "shape", "form", "figure", "pattern",
      "design", "style", "fashion", "trend", "modern", "classic", "vintage",
      "retro", "contemporary", "traditional", "conventional", "standard",
      "basic", "advanced", "premium", "deluxe", "luxury", "economy", "budget",
      "affordable", "expensive", "cheap", "free", "paid", "cost", "price",
      "value", "worth", "benefit", "advantage", "disadvantage", "problem",
      "issue", "concern", "risk", "danger", "hazard", "threat", "warning",
      "caution", "notice", "alert", "attention", "focus", "emphasis", "stress",
      "important", "critical", "essential", "necessary", "required", "mandatory",
      "optional", "recommended", "suggested", "advised", "instructed",
      "directed", "ordered", "commanded", "requested", "asked", "questioned",
      "inquired", "investigated", "researched", "studied", "analyzed",
      "examined", "reviewed", "evaluated", "assessed", "judged", "decided",
      "determined", "concluded", "finished", "completed", "done"
    ];
    if (commonShortWords.includes(lowerClean)) return false;
  }
  
  // Avoid codes that are mostly consonants or mostly vowels (common OCR errors)
  // Apply ONLY to tokens without digits to avoid rejecting valid alphanumerics like "x8BRJ9cmpT"
  if (!hasDigit) {
    const vowels = /[AEIOUaeiou]/g;
    const consonants = /[BCDFGHJKLMNPQRSTVWXYZbcdfghjklmnpqrstvwxyz]/g;
    const vowelCount = (clean.match(vowels) || []).length;
    const consonantCount = (clean.match(consonants) || []).length;
    const totalLetters = vowelCount + consonantCount;

    if (totalLetters >= 6) {
      const vowelRatio = vowelCount / totalLetters;
      const consonantRatio = consonantCount / totalLetters;

      // If more than 80% vowels or consonants, likely an OCR error
      if (vowelRatio > 0.8 || consonantRatio > 0.8) return false;

      // If more than 70% consonants and word is short, likely an OCR error
      if (consonantRatio > 0.7 && clean.length <= 10) return false;
    }
  }
  
  // Avoid codes that contain common English word patterns
  // Apply English-word prefix/suffix patterns only to tokens without digits
  const commonPatterns = hasDigit ? [] : [
    /^THE[A-Z0-9]*$/i,  // THE + anything
    /^AND[A-Z0-9]*$/i,  // AND + anything  
    /^FOR[A-Z0-9]*$/i,  // FOR + anything
    /^WITH[A-Z0-9]*$/i, // WITH + anything
    /^FROM[A-Z0-9]*$/i, // FROM + anything
    /^THIS[A-Z0-9]*$/i, // THIS + anything
    /^THAT[A-Z0-9]*$/i, // THAT + anything
    /^HAVE[A-Z0-9]*$/i, // HAVE + anything
    /^WILL[A-Z0-9]*$/i, // WILL + anything
    /^SHALL[A-Z0-9]*$/i, // SHALL + anything
    /^SHOULD[A-Z0-9]*$/i, // SHOULD + anything
    /^WOULD[A-Z0-9]*$/i, // WOULD + anything
    /^COULD[A-Z0-9]*$/i, // COULD + anything
    /^MIGHT[A-Z0-9]*$/i, // MIGHT + anything
    /^MAY[A-Z0-9]*$/i,  // MAY + anything
    /^MUST[A-Z0-9]*$/i, // MUST + anything
    /^CAN[A-Z0-9]*$/i,  // CAN + anything (but not just "CAN" by itself)
    /^ING[A-Z0-9]*$/i,  // ING + anything (common suffix)
    /^ED[A-Z0-9]*$/i,   // ED + anything (common suffix)
    /^ER[A-Z0-9]*$/i,   // ER + anything (common suffix)
    /^LY[A-Z0-9]*$/i,   // LY + anything (common suffix)
    /^TION[A-Z0-9]*$/i, // TION + anything (common suffix)
    /^SION[A-Z0-9]*$/i, // SION + anything (common suffix)
    /^NESS[A-Z0-9]*$/i, // NESS + anything (common suffix)
    /^MENT[A-Z0-9]*$/i, // MENT + anything (common suffix)
    /^ABLE[A-Z0-9]*$/i, // ABLE + anything (common suffix)
    /^IBLE[A-Z0-9]*$/i, // IBLE + anything (common suffix)
    /^FUL[A-Z0-9]*$/i,  // FUL + anything (common suffix)
    /^LESS[A-Z0-9]*$/i, // LESS + anything (common suffix)
    /^SOME[A-Z0-9]*$/i, // SOME + anything
    /^BODY[A-Z0-9]*$/i, // BODY + anything
    /^THING[A-Z0-9]*$/i, // THING + anything
    /^WHERE[A-Z0-9]*$/i, // WHERE + anything
    /^WHEN[A-Z0-9]*$/i, // WHEN + anything
    /^WHY[A-Z0-9]*$/i,  // WHY + anything
    /^HOW[A-Z0-9]*$/i,  // HOW + anything
    /^WHAT[A-Z0-9]*$/i, // WHAT + anything
    /^WHO[A-Z0-9]*$/i,  // WHO + anything
    /^WHICH[A-Z0-9]*$/i, // WHICH + anything
    /^WHOSE[A-Z0-9]*$/i, // WHOSE + anything
    /^WHOM[A-Z0-9]*$/i, // WHOM + anything
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(clean)) return false;
  }
  
  return true;
};
