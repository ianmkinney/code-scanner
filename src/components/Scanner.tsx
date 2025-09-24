"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import Tesseract from "tesseract.js";
import { supabase } from "../lib/supabase";

type StatusKind = "info" | "success" | "error";

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scanBanner, setScanBanner] = useState<{ msg: string; kind: StatusKind } | null>(null);
  const [status, setStatus] = useState<{ msg: string; kind: StatusKind } | null>(null);
  // const [attemptCount, setAttemptCount] = useState(0);
  const [mpLabel, setMpLabel] = useState("MP");
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [username, setUsername] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [userCans, setUserCans] = useState<Array<{id: string, code: string, created_at: string}> | null>(null);
  const [userColor, setUserColor] = useState<string>("#00cc6a");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const ocrTimerRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mpPollRef = useRef<number | null>(null);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setUserColor(newColor);
    document.documentElement.style.setProperty("--can-green", newColor);
  };

  // Update title text shadow when user color changes
  useEffect(() => {
    const titleElement = document.querySelector('.app-title') as HTMLElement;
    if (titleElement) {
      titleElement.style.textShadow = `0 0 30px ${userColor}50`;
    }
  }, [userColor]);

  const showBanner = useCallback((msg: string, kind: StatusKind = "info") => {
    setScanBanner({ msg, kind });
  }, []);

  const hideBanner = useCallback(() => setScanBanner(null), []);

  const showStatus = useCallback((msg: string, kind: StatusKind) => {
    setStatus({ msg, kind });
    setScanBanner({ msg, kind });
  }, []);

  // isURL removed (unused)

  const isValidProductCode = (code: string) => {
    const clean = code.trim().replace(/\s/g, "");
    
    // Basic length check
    if (clean.length < 6 || clean.length > 25) return false;
    
    // Must be alphanumeric only
    if (!/^[A-Za-z0-9]+$/.test(clean)) return false;
    
    // Cannot be all numbers
    if (/^\d+$/.test(clean)) return false;
    
    // Cannot be all letters
    if (/^[A-Za-z]+$/.test(clean)) return false;
    
    // Must have at least one letter and one number
    if (!/[A-Za-z]/.test(clean) || !/\d/.test(clean)) return false;
    
    // Check against common non-code words that might be detected by OCR
    const common = [
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
      "PI", "RHO", "SIGMA", "TAU", "UPSILON", "PHI", "CHI", "PSI", "OMEGA"
    ];
    
    // Check if it's a common word
    if (common.includes(clean.toUpperCase())) return false;
    
    // Additional pattern checks for common false positives
    // Avoid codes that look like version numbers (e.g., "1.2.3", "v1.0")
    if (/^v?\d+\.\d+/.test(clean)) return false;
    
    // Avoid codes that look like dates (e.g., "20240101", "2024-01-01")
    if (/^\d{4}[-/]?\d{2}[-/]?\d{2}$/.test(clean)) return false;
    
    // Avoid codes that look like times (e.g., "12:34:56", "123456")
    if (/^\d{1,2}[:.]?\d{2}[:.]?\d{2}$/.test(clean)) return false;
    
    // Avoid codes that are too repetitive (e.g., "AAAA1111", "1111AAAA")
    if (/(.)\1{3,}/.test(clean)) return false;
    
    // Avoid codes that are sequential (e.g., "123456", "ABCDEF")
    if (/^(0123456789|1234567890|9876543210|0987654321|ABCDEFGHIJ|abcdefghij|ZYXWVUTSRQ|zyxwvutsrq)$/.test(clean)) return false;
    
    // Avoid codes that are too simple patterns (e.g., "A1A1A1", "1A1A1A")
    if (/^([A-Za-z]\d){2,}$/.test(clean) && clean.length <= 8) return false;
    if (/^(\d[A-Za-z]){2,}$/.test(clean) && clean.length <= 8) return false;
    
    return true;
  };

  const extractCodeFromURL = useCallback((url: string) => {
    try {
      const ensure = url.startsWith("http") ? url : `https://${url}`;
      const u = new URL(ensure);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length) {
        const last = parts[parts.length - 1];
        if (isValidProductCode(last)) return last;
        if (parts.length > 1) {
          const prev = parts[parts.length - 2];
          if (isValidProductCode(prev)) return prev;
        }
      }
      const params = new URLSearchParams(u.search);
      for (const [k, v] of params) {
        if (k.toLowerCase().includes("code") && isValidProductCode(v)) return v;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // stopCamera defined later
  const stopCamera = useCallback(() => {
    setIsScanning(false);
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      mediaStreamRef.current = null;
    }
    if (ocrTimerRef.current) { window.clearInterval(ocrTimerRef.current); ocrTimerRef.current = null; }
    hideBanner();
  }, [hideBanner]);

  const processFoundCode = useCallback(async (code: string) => {
    // Check duplicate in Supabase (if configured)
    if (supabase) {
      try {
        const { data: existing, error: selErr } = await supabase
          .from("scanned_codes")
          .select("id, code")
          .eq("code", code)
          .maybeSingle();
        if (selErr) throw selErr;
        if (existing) {
          setScannedCode(code);
          stopCamera();
          showStatus("This code was already scanned.", "error");
          showBanner(`⚠️ Already scanned: ${code}`, "error");
          try { await navigator.clipboard.writeText(code); } catch {}
          return;
        }
      } catch {
        // non-fatal; continue
      }
    }

    setScannedCode(code);
    stopCamera();
    showStatus("Code found! Copied to clipboard.", "success");
    showBanner(`✅ Found: ${code}`, "success");
    try {
      await navigator.clipboard.writeText(code);
      showBanner("✅ Copied to clipboard", "success");
    } catch {}
    try {
      const audioWin = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AudioCtor = audioWin.AudioContext || audioWin.webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
    window.setTimeout(() => hideBanner(), 3500);

    // Save new code via secure API route
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (userId) {
        headers['X-User-ID'] = userId;
      }
      
      const response = await fetch('/api/save-code', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });
      
      if (response.ok) {
        setTotalCount((n) => (typeof n === "number" ? n + 1 : n));
        if (userId) {
          setUserCount((n) => (typeof n === "number" ? n + 1 : n));
          // Refresh user cans list
          if (supabase) {
            const { data: cans } = await supabase
              .from("scanned_codes")
              .select("id, code, created_at")
              .eq("user_id", userId)
              .order("created_at", { ascending: false });
            setUserCans(cans || []);
          }
        }
      }
    } catch {
      // ignore persistence errors for UX
    }
  }, [hideBanner, showBanner, showStatus, stopCamera, userId]);

  // handleCodeFound removed (direct flows call processFoundCode)

  const readQrInViewfinderOnce = useCallback((): { text: string } | null => {
    try {
      const viewport = viewportRef.current;
      const video = videoRef.current;
      const vf = document.querySelector<HTMLDivElement>(".viewfinder-wrap");
      if (!viewport || !video || !vf) return null;
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;
      if (!vw || !vh) return null;
      const vpRect = viewport.getBoundingClientRect();
      const vfRect = vf.getBoundingClientRect();
      const scaleX = vw / vpRect.width;
      const scaleY = vh / vpRect.height;
      const vfTopYVideo = (vfRect.top - vpRect.top) * scaleY;
      const vfLeftXVideo = (vfRect.left - vpRect.left) * scaleX;
      const vfWidthVideo = Math.floor(vfRect.width * scaleX);
      const vfHeightVideo = Math.floor(vfRect.height * scaleY);
      const canvas = document.createElement("canvas");
      canvas.width = vfWidthVideo;
      canvas.height = vfHeightVideo;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(
        video,
        Math.floor(vfLeftXVideo),
        Math.floor(vfTopYVideo),
        vfWidthVideo,
        vfHeightVideo,
        0,
        0,
        vfWidthVideo,
        vfHeightVideo
      );
      const imageData = ctx.getImageData(0, 0, vfWidthVideo, vfHeightVideo);
      const result = jsQR(imageData.data, vfWidthVideo, vfHeightVideo, { inversionAttempts: "attemptBoth" });
      if (result && result.data) return { text: result.data };
      return null;
    } catch {
      return null;
    }
  }, []);

  const ocrUnderViewfinderOnce = useCallback(async (silent = true) => {
    try {
      const viewport = viewportRef.current;
      const video = videoRef.current;
      const vf = document.querySelector<HTMLDivElement>(".viewfinder-wrap");
      if (!viewport || !video || !vf) return null;
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const vpRect = viewport.getBoundingClientRect();
      const vfRect = vf.getBoundingClientRect();
      const scaleX = vw / vpRect.width;
      const scaleY = vh / vpRect.height;
      const vfBottomYVideo = (vfRect.bottom - vpRect.top) * scaleY;
      const vfLeftXVideo = (vfRect.left - vpRect.left) * scaleX;
      const vfWidthVideo = vfRect.width * scaleX;
      const margin = Math.floor(vfRect.height * 0.04 * scaleY);
      const stripHeight = Math.floor(vfRect.height * 0.16 * scaleY);
      const centerX = Math.floor(vfLeftXVideo + vfWidthVideo / 2);
      const halfStripWidth = Math.floor(vfWidthVideo * 0.35);
      const ocrX = Math.max(0, centerX - halfStripWidth);
      const ocrY = Math.min(vh - 1, Math.floor(vfBottomYVideo + margin));
      const ocrWidth = Math.min(vw - ocrX, halfStripWidth * 2);
      const ocrHeight = Math.min(vh - ocrY, stripHeight);
      const canvas = document.createElement("canvas");
      canvas.width = ocrWidth;
      canvas.height = ocrHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, ocrX, ocrY, ocrWidth, ocrHeight, 0, 0, ocrWidth, ocrHeight);
      const imageData = ctx.getImageData(0, 0, ocrWidth, ocrHeight);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        gray = Math.max(0, Math.min(255, (gray - 110) * 2.2));
        const bw = gray > 150 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = bw;
      }
      ctx.putImageData(imageData, 0, 0);
      if (!silent) showBanner("🔎 Reading code under QR...", "info");
      // Note: tesseract.js types are permissive; we pass vendor-specific params
      const { data: { text } } = await Tesseract.recognize(canvas.toDataURL("image/png"), "eng");
      const raw = (text || "").replace(/\s+/g, " ").trim();
      const tokens = raw.split(/[^A-Za-z0-9]+/).filter(Boolean);
      let best = "";
      
      for (const t of tokens) {
        // Only consider tokens that are valid product codes
        if (t.length > best.length && isValidProductCode(t)) {
          best = t;
        }
      }
      
      return best || null;
    } catch {
      return null;
    }
  }, [showBanner]);

  const updateMp = useCallback(() => {
    try {
      const track = mediaStreamRef.current?.getVideoTracks?.()[0];
      const settings = track?.getSettings?.();
      let vw = typeof settings?.width === "number" ? settings!.width : 0;
      let vh = typeof settings?.height === "number" ? settings!.height : 0;

      // Fallback to actual playing video dimensions
      if (!vw || !vh) {
        const v = videoRef.current;
        if (v && v.videoWidth && v.videoHeight) {
          vw = v.videoWidth;
          vh = v.videoHeight;
        }
      }

      let mpNumber = 0;
      if (vw && vh) {
        mpNumber = (vw * vh) / 1_000_000;
      }

      // If still unknown, estimate from capabilities (approx sensor/stream max)
      if (!mpNumber && track) {
        type TrackWithCaps = MediaStreamTrack & { getCapabilities?: () => { width?: { max?: number }, height?: { max?: number } } };
        const t = track as TrackWithCaps;
        const caps = typeof t.getCapabilities === "function" ? t.getCapabilities() : undefined;
        const wMax = caps?.width?.max;
        const hMax = caps?.height?.max;
        if (typeof wMax === "number" && typeof hMax === "number" && wMax > 0 && hMax > 0) {
          mpNumber = (wMax * hMax) / 1_000_000;
        }
      }

      if (mpNumber > 0) {
        const rounded = mpNumber >= 10 ? Math.round(mpNumber) : Math.round(mpNumber * 10) / 10;
        setMpLabel(`${rounded}MP`);
      } else {
        setMpLabel("MP");
      }
    } catch {
      // ignore
    }
  }, []);

  // Wait for the <video> element to have non-zero dimensions
  const waitForVideoDims = useCallback(async () => {
    for (let i = 0; i < 25; i++) {
      const v = videoRef.current;
      if (v && v.videoWidth && v.videoHeight) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  }, []);

  // const startCameraLegacy = useCallback(async () => {
  //   try {
  //     showStatus("Requesting camera access...", "info");
  //     if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
  //       showStatus("Camera requires HTTPS. Use your tunnel link.", "error");
  //       return;
  //     }
  //     if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported on this device");
  //     const devices = await navigator.mediaDevices.enumerateDevices();
  //     const inputs = devices.filter((d) => d.kind === "videoinput");
  //     const back = inputs.find((d) => /back|rear|environment/i.test(d.label));
  //     const envFacing: ConstrainDOMString = "environment";
  //     const constraints: MediaStreamConstraints = back
  //       ? { video: { deviceId: { exact: back.deviceId } } }
  //       : { video: { facingMode: { ideal: envFacing } } };
  //     const stream = await navigator.mediaDevices.getUserMedia(constraints);
  //     mediaStreamRef.current = stream;
  //     if (!viewportRef.current) return;
  //     if (!videoRef.current) {
  //       const v = document.createElement("video");
  //       v.setAttribute("playsinline", "true");
  //       v.muted = true;
  //       v.autoplay = true;
  //       v.style.width = "100%";
  //       v.style.height = "100%";
  //       viewportRef.current.innerHTML = "";
  //       viewportRef.current.appendChild(v);
  //       videoRef.current = v;
  //     }
  //     const video = videoRef.current!;
  //     video.srcObject = stream;
  //     // Update MP asap based on track settings
  //     updateMp();
  //     await video.play();
  //     await waitForVideoDims();
  //     updateMp();
  //     // Aggressive polling for first few seconds to ensure non-zero MP
  //     if (mpPollRef.current) { window.clearInterval(mpPollRef.current); mpPollRef.current = null; }
  //     let polls = 0;
  //     mpPollRef.current = window.setInterval(() => {
  //       polls += 1;
  //       updateMp();
  //       if (polls >= 30) { // ~6 seconds at 200ms
  //         if (mpPollRef.current) { window.clearInterval(mpPollRef.current); mpPollRef.current = null; }
  //       }
  //     }, 200) as number;
  //     // Update MP again when metadata/size known
  //     video.onloadedmetadata = () => updateMp();
  //     // Some browsers fire resize when dimensions change
  //     video.onresize = () => updateMp();
  //     setIsScanning(true);
  //     showStatus("Camera active - align code under QR in window", "success");
  //     showBanner("📷 Scanning for code under QR...", "info");
  //     window.setTimeout(updateMp, 800);
  //     if (ocrTimerRef.current) {
  //       window.clearInterval(ocrTimerRef.current);
  //       ocrTimerRef.current = null;
  //     }
  //     ocrTimerRef.current = window.setInterval(async () => {
  //       updateMp();
  //       if (!videoRef.current) return;
  //       const qr = readQrInViewfinderOnce();
  //       let printed: string | null = null;
  //       if (qr && qr.text) {
  //         const urlCode = extractCodeFromURL(qr.text) || null;
  //         printed = await ocrUnderViewfinderOnce(true);
  //         if (printed) processFoundCode(printed);
  //         else if (urlCode) processFoundCode(urlCode);
  //       } else {
  //         printed = await ocrUnderViewfinderOnce(true);
  //         if (printed) processFoundCode(printed);
  //       }
  //       // attempt counter disabled
  //     }, 1200) as number;
  //   } catch {
  //     showStatus("Camera not available. Please use manual entry.", "error");
  //     // console.error(e);
  //   }
  // }, [extractCodeFromURL, ocrUnderViewfinderOnce, processFoundCode, readQrInViewfinderOnce, showBanner, showStatus, updateMp, waitForVideoDims]);

  const startCamera = useCallback(async () => {
    try {
      showStatus("Requesting camera access...", "info");
      if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
        showStatus("Camera requires HTTPS. Use your tunnel link.", "error");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported on this device");
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "videoinput");
      const back = inputs.find((d) => /back|rear|environment/i.test(d.label));
      const envFacing: ConstrainDOMString = "environment";
      const constraints: MediaStreamConstraints = back
        ? { video: { deviceId: { exact: back.deviceId } } }
        : { video: { facingMode: { ideal: envFacing } } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (!viewportRef.current) return;
      if (!videoRef.current) {
        const v = document.createElement("video");
        v.setAttribute("playsinline", "true");
        v.muted = true;
        v.autoplay = true;
        v.style.width = "100%";
        v.style.height = "100%";
        viewportRef.current.innerHTML = "";
        viewportRef.current.appendChild(v);
        videoRef.current = v;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      updateMp();
      await video.play();
      await waitForVideoDims();
      updateMp();
      if (mpPollRef.current) { window.clearInterval(mpPollRef.current); mpPollRef.current = null; }
      let polls = 0;
      mpPollRef.current = window.setInterval(() => {
        polls += 1;
        updateMp();
        if (polls >= 30) { if (mpPollRef.current) { window.clearInterval(mpPollRef.current); mpPollRef.current = null; } }
      }, 200) as number;
      video.onloadedmetadata = () => updateMp();
      video.onresize = () => updateMp();
      setIsScanning(true);
      showStatus("Camera active - align code under QR in window", "success");
      showBanner("📷 Scanning for code under QR...", "info");
      window.setTimeout(updateMp, 800);
      if (ocrTimerRef.current) {
        window.clearInterval(ocrTimerRef.current);
        ocrTimerRef.current = null;
      }
      ocrTimerRef.current = window.setInterval(async () => {
        updateMp();
        if (!videoRef.current) return;
        const qr = readQrInViewfinderOnce();
        let printed: string | null = null;
        
        if (qr && qr.text) {
          const urlCode = extractCodeFromURL(qr.text) || null;
          printed = await ocrUnderViewfinderOnce(true);
          
          // Only process if we have a valid code
          if (printed && isValidProductCode(printed)) {
            processFoundCode(printed);
          } else if (urlCode && isValidProductCode(urlCode)) {
            processFoundCode(urlCode);
          }
        } else {
          printed = await ocrUnderViewfinderOnce(true);
          
          // Only process if we have a valid code
          if (printed && isValidProductCode(printed)) {
            processFoundCode(printed);
          }
        }
      }, 1200) as number;
    } catch {
      showStatus("Camera not available. Please use manual entry.", "error");
    }
  }, [extractCodeFromURL, ocrUnderViewfinderOnce, processFoundCode, readQrInViewfinderOnce, showBanner, showStatus, updateMp, waitForVideoDims]);

  const resetScanner = useCallback(() => {
    setScannedCode(null);
    // attempt counter disabled
    setStatus(null);
    hideBanner();
    startCamera();
  }, [hideBanner, startCamera]);

  useEffect(() => {
    return () => {
      if (ocrTimerRef.current) window.clearInterval(ocrTimerRef.current);
      if (mpPollRef.current) window.clearInterval(mpPollRef.current);
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Load total scanned codes count on mount
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        const { count, error } = await supabase
          .from("scanned_codes")
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        setTotalCount(typeof count === "number" ? count : 0);
      } catch {
        setTotalCount(null);
      }
    })();
  }, []);

  // Apply CSS var whenever userColor changes
  useEffect(() => {
    document.documentElement.style.setProperty("--can-green", userColor);
  }, [userColor]);

  // Load per-user count and cans when userId changes
  useEffect(() => {
    (async () => {
      if (!supabase || !userId) { 
        setUserCount(null); 
        setUserCans(null);
        // reset to default color when no user selected
        setUserColor("#00cc6a");
        document.documentElement.style.setProperty("--can-green", "#00cc6a");
        return; 
      }
      try {
        const { count, error } = await supabase
          .from("scanned_codes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        if (error) throw error;
        setUserCount(typeof count === "number" ? count : 0);

        // Load user cans
        const { data: cans, error: cansError } = await supabase
          .from("scanned_codes")
          .select("id, code, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (cansError) throw cansError;
        setUserCans(cans || []);

        // Note: User color is loaded during login, not here to avoid overriding
      } catch {
        setUserCount(null);
        setUserCans(null);
      }
    })();
  }, [userId]);

  // Persist user color when it changes and a user is selected
  // (Removed client-side direct save to avoid conflicts with API auth flow)

  const onSubmitToZyn = async () => {
    if (!scannedCode) return;
    showStatus("Opening ZYN Rewards...", "info");
    try {
      await navigator.clipboard.writeText(scannedCode);
      const zynUrl = "https://us.zyn.com/ZYNRewards";
      window.open(zynUrl, "_blank");
      showStatus("Code copied! Paste in ZYN Rewards form.", "success");
    } catch {
      showStatus(`Error opening site. Your code is: ${scannedCode}`, "error");
    }
  };


  return (
    <div className="container">
      {/* Cans Scanned Counter */}
      {supabase && (
        <div className="customize" style={{ 
          marginBottom: 12, 
          width: "100%", 
          justifyContent: "center",
          animation: "fadeInDown 0.6s ease-out"
        }}>
          <strong>Cans Scanned:&nbsp;</strong>
          <span>{totalCount ?? "—"}</span>
        </div>
      )}

      {/* Can Scan Title */}
      <h1 
        className="app-title"
        style={{ 
          '--can-green': userColor,
          textShadow: `0 0 30px ${userColor}50`
        } as React.CSSProperties}
      >
        Can Scan
      </h1>

      {/* Scanner Section - Moved to top */}
      <div className="scan-section" style={{ animation: "flipIn 1.2s ease-out" }}>
        <div className="puck" id="puck" title="Tap to start camera" onClick={startCamera}>
          <div className="puck-ring" />
          <div className="puck-green">
            <div className="puck-green-top" />
          </div>
          <div className="viewfinder-wrap">
            <div id="scanner-viewport" ref={viewportRef} />
          </div>
          <div id="mpLabel" className="mp-label">{mpLabel}</div>
          <button id="startScanButton" className="start-btn" onClick={(e) => { e.stopPropagation(); startCamera(); }} style={{ display: isScanning ? "none" : "inline-block" }}>
            Start Scan
          </button>
          <button id="stopScanButton" className="stop-btn" onClick={(e) => { e.stopPropagation(); stopCamera(); if (viewportRef.current) viewportRef.current.innerHTML = ""; }} style={{ display: isScanning ? "inline-block" : "none" }}>
            Stop Scan
          </button>
        </div>
      </div>

      {/* Scan Feedback */}
      <div id="scanFeedback" className={`scan-feedback ${scanBanner ? "show " + scanBanner.kind : ""}`} style={{ pointerEvents: "none" }}>
        {scanBanner?.msg}
      </div>

      {/* Result Section */}
      <div id="resultSection" className={`result-section ${scannedCode ? "" : "hidden"}`} style={{ animation: "slideInUp 0.5s ease-out" }}>
        <h3>Found Code:</h3>
        <div id="codeDisplay" className="code-display">{scannedCode || ""}</div>
        <div id="clipboardNotification" className="clipboard-notification" style={{ display: scannedCode ? "block" : "none" }}>
          📋 Code copied to clipboard! Paste into ZYN Rewards for your points.
        </div>
        <button id="submitCode" className="btn btn-primary" style={{ width: "100%", marginBottom: 10 }} onClick={onSubmitToZyn}>
          🌐 Go to ZYN Rewards
        </button>
        <button id="scanAgain" className="btn btn-secondary" style={{ width: "100%" }} onClick={resetScanner}>
          🔄 Scan Another
        </button>
      </div>

      {/* User Management Section */}
      {supabase && (
        <div className="customize" style={{ 
          marginBottom: 12, 
          width: "100%", 
          justifyContent: "center", 
          flexDirection: "column", 
          gap: 8,
          animation: "fadeInUp 1s ease-out"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <div style={{ fontWeight: 600 }}>Your cans{userCount !== null ? `: ${userCount}` : ":"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <span style={{ opacity: 0.8, fontSize: 12 }}>Want to save your cans? give your name</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              style={{ 
                padding: "6px 10px", 
                borderRadius: 8, 
                border: "1px solid rgba(255,255,255,0.3)", 
                background: "rgba(255,255,255,0.1)", 
                color: "#fff",
                transition: "all 0.3s ease"
              }}
            />
            <button className="btn btn-small" onClick={async () => {
              if (!supabase) return;
              const name = username.trim();
              if (!name) { showStatus("Please enter a name.", "error"); return; }
              // Try to find
              const { data: existing } = await supabase.from("users").select("id, color").eq("name", name).maybeSingle();
              if (existing?.id) { 
                console.log("👤 Loading existing user:", existing);
                setUserId(existing.id);
                const colorToUse = existing.color && typeof existing.color === "string" ? existing.color : "#00cc6a";
                setUserColor(colorToUse);
                document.documentElement.style.setProperty("--can-green", colorToUse);
                showStatus(`Loaded ${name}'s cans.`, "success"); 
                return; 
              }
              // Create new (handle unique violation by re-prompt)
              console.log("🆕 Creating new user:", { name, color: userColor });
              const { data: created, error } = await supabase.from("users").insert({ name, color: userColor }).select("id, color").maybeSingle();
              console.log("📊 User creation response:", { created, error });
              if (error || !created?.id) { 
                console.error("❌ Failed to create user:", error);
                showStatus("Name taken or cannot create. Try another.", "error"); 
                return; 
              }
              setUserId(created.id);
              const colorToUse = created.color && typeof created.color === "string" ? created.color : userColor;
              setUserColor(colorToUse);
              document.documentElement.style.setProperty("--can-green", colorToUse);
              showStatus(`Welcome, ${name}. Your cans will be saved.`, "success");
            }}>
              Save
            </button>
          </div>
          
          {/* User cans list */}
          {userCans && userCans.length > 0 && (
            <div style={{ 
              marginTop: 12, 
              maxHeight: "200px", 
              overflowY: "auto", 
              border: "1px solid rgba(255,255,255,0.2)", 
              borderRadius: 8, 
              padding: 8,
              background: "rgba(255,255,255,0.05)",
              animation: "slideInUp 0.6s ease-out"
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8, textAlign: "center" }}>Your Scanned Cans:</div>
              {userCans.map((can, index) => (
                <div key={can.id} style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "4px 8px", 
                  marginBottom: 4,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  fontSize: 12,
                  animation: `fadeInUp 0.4s ease-out ${index * 0.1}s both`
                }}>
                  <div style={{ fontWeight: 500 }}>{can.code}</div>
                  <div style={{ opacity: 0.7 }}>
                    {new Date(can.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Color Customization */}
      <div className="customize" style={{ 
        marginBottom: 12,
        animation: "fadeInUp 1.2s ease-out"
      }}>
        <label htmlFor="colorPicker">Customize your can:</label>
        <input 
          id="colorPicker" 
          type="color" 
          value={userColor} 
          onChange={handleColorChange}
          style={{ transition: "all 0.3s ease" }}
        />
        {userId && (
          <button 
            className="btn btn-small" 
            onClick={async () => {
              if (!userId) {
                showStatus("Not logged in.", "error");
                return;
              }
              
              try {
                const response = await fetch('/api/save-color', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'X-User-ID': userId
                  },
                  body: JSON.stringify({ color: userColor })
                });
                
                if (response.ok) {
                  showStatus("Color saved!", "success");
                } else {
                  const error = await response.json();
                  showStatus(`Failed to save color: ${error.error}`, "error");
                }
              } catch (err) {
                showStatus("Failed to save color.", "error");
                console.error("Color save error:", err);
              }
            }}
            style={{ marginLeft: 8 }}
          >
            Save Color
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="instructions-compact" style={{ animation: "fadeInUp 1.4s ease-out" }}>
        <ul style={{ textAlign: "left", margin: 0, paddingLeft: 18, listStyleType: "disc" }}>
          <li>Line up the QR code and the printed code beneath it inside the frame.</li>
          <br />
          <li>The app auto-detects when both are clear and reads the printed code.</li>
          <br />
          <li>Log in to ZYN Rewards once and keep the tab open for quick entry.</li>
          <br />
          <li>Scan multiple cans; codes are copied to your clipboard automatically.</li>
        </ul>
      </div>

      <div id="status" className={`status ${status ? status.kind : "hidden"}`}>{status?.msg}</div>

      <div className="footer" style={{ display: "none" }} />
    </div>
  );
}


