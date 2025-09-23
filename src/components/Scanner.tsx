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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const ocrTimerRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mpPollRef = useRef<number | null>(null);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    document.documentElement.style.setProperty("--can-green", e.target.value);
  };

  const showBanner = useCallback((msg: string, kind: StatusKind = "info") => {
    setScanBanner({ msg, kind });
  }, []);

  const hideBanner = useCallback(() => setScanBanner(null), []);

  const showStatus = useCallback((msg: string, kind: StatusKind) => {
    setStatus({ msg, kind });
    setScanBanner({ msg, kind });
  }, []);

  const isURL = (text: string) => {
    try {
      new URL(text);
      return true;
    } catch {
      const t = text.toLowerCase();
      return t.includes("http") || t.includes("www.") || /\.[a-z]{2,}$/i.test(text);
    }
  };

  const isValidProductCode = (code: string) => {
    const clean = code.trim().replace(/\s/g, "");
    if (clean.length < 6 || clean.length > 25) return false;
    if (!/^[A-Za-z0-9]+$/.test(clean)) return false;
    if (/^\d+$/.test(clean)) return false;
    const common = [
      "CODE",
      "PRODUCT",
      "ITEM",
      "SKU",
      "BARCODE",
      "SCAN",
      "ENTER",
      "REWARDS",
      "ZYN",
    ];
    return !common.includes(clean.toUpperCase());
  };

  const extractCodeFromURL = (url: string) => {
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
  };

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
      } catch (e) {
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

    // Save new code to Supabase (if configured)
    if (supabase) {
      try {
        const { error } = await supabase
          .from("scanned_codes")
          .insert({ code });
        if (!error) setTotalCount((n) => (typeof n === "number" ? n + 1 : n));
      } catch (e) {
        // ignore persistence errors for UX
      }
    }
  }, [hideBanner, showBanner, showStatus]);

  const handleCodeFound = useCallback(
    (value: string) => {
      const clean = value.replace(/\s+/g, "");
      if (/^[A-Za-z0-9]{6,40}$/.test(clean) && !isURL(clean)) {
        processFoundCode(clean);
        return;
      }
      if (isURL(clean)) {
        showBanner("🔗 Found URL! Extracting code...", "info");
        const extracted = extractCodeFromURL(clean);
        if (extracted) processFoundCode(extracted);
        else showStatus("No product code found in the URL path", "error");
        return;
      }
      processFoundCode(clean);
    },
    [processFoundCode, showBanner, showStatus]
  );

  const readQrInViewfinderOnce = useCallback(() => {
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
        if (t.length > best.length && t.length >= 6 && t.length <= 25 && !/^\d+$/.test(t)) {
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
      if (!mpNumber && track && typeof (track as any).getCapabilities === "function") {
        const caps: any = (track as any).getCapabilities();
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
      const constraints: MediaStreamConstraints = back
        ? { video: { deviceId: { exact: back.deviceId } as any } }
        : { video: { facingMode: { ideal: "environment" } as any } };
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
      // Update MP asap based on track settings
      updateMp();
      await video.play();
      await waitForVideoDims();
      updateMp();
      // Aggressive polling for first few seconds to ensure non-zero MP
      if (mpPollRef.current) { window.clearInterval(mpPollRef.current); mpPollRef.current = null; }
      let polls = 0;
      mpPollRef.current = window.setInterval(() => {
        polls += 1;
        updateMp();
        if (polls >= 30) { // ~6 seconds at 200ms
          if (mpPollRef.current) { window.clearInterval(mpPollRef.current); mpPollRef.current = null; }
        }
      }, 200) as unknown as number;
      // Update MP again when metadata/size known
      video.onloadedmetadata = () => updateMp();
      // Some browsers fire resize when dimensions change
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
        if (qr && (qr as any).text) {
          const urlCode = extractCodeFromURL((qr as any).text) || null;
          printed = await ocrUnderViewfinderOnce(true);
          if (printed) processFoundCode(printed);
          else if (urlCode) processFoundCode(urlCode);
        } else {
          printed = await ocrUnderViewfinderOnce(true);
          if (printed) processFoundCode(printed);
        }
        // attempt counter disabled
      }, 1200) as unknown as number;
    } catch (e: any) {
      showStatus("Camera not available. Please use manual entry.", "error");
      console.error(e);
    }
  }, [extractCodeFromURL, ocrUnderViewfinderOnce, processFoundCode, readQrInViewfinderOnce, showBanner, showStatus, updateMp, waitForVideoDims]);

  const stopCamera = useCallback(() => {
    setIsScanning(false);
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    if (ocrTimerRef.current) {
      window.clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    hideBanner();
  }, [hideBanner]);

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

  const onSubmitToZyn = async () => {
    if (!scannedCode) return;
    showStatus("Opening ZYN Rewards...", "info");
    try {
      await navigator.clipboard.writeText(scannedCode);
      const zynUrl = "https://us.zyn.com/ZYNRewards";
      window.open(zynUrl, "_blank");
      showStatus("Code copied! Paste in ZYN Rewards form.", "success");
    } catch (e) {
      showStatus(`Error opening site. Your code is: ${scannedCode}`, "error");
    }
  };

  const mockTest = () => processFoundCode("AbC123xYz789");

  return (
    <div className="container">
      {supabase && (
        <div className="customize" style={{ marginBottom: 12, width: "100%", justifyContent: "center" }}>
          <strong>Total codes scanned:&nbsp;</strong>
          <span>{totalCount ?? "—"}</span>
        </div>
      )}
      <div className="customize" style={{ marginBottom: 12 }}>
        <label htmlFor="colorPicker">Customize your can:</label>
        <input id="colorPicker" type="color" defaultValue="#00cc6a" onChange={handleColorChange} />
        <button id="testMock" className="btn btn-small" onClick={mockTest} style={{ marginLeft: "auto" }}>
          Test Mock Code
        </button>
      </div>

      <div id="scanFeedback" className={`scan-feedback ${scanBanner ? "show " + scanBanner.kind : ""}`} style={{ pointerEvents: "none" }}>
        {scanBanner?.msg}
      </div>

      <div id="resultSection" className={`result-section ${scannedCode ? "" : "hidden"}`}>
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

      <div className="scan-section">
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

      <div className="instructions-compact">
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


