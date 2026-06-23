const video = document.querySelector("#webcam");
const canvas = document.querySelector("#overlay");
const ctx = canvas.getContext("2d");
const cameraButton = document.querySelector("#cameraButton");
const flipButton = document.querySelector("#flipButton");
const modeButton = document.querySelector("#modeButton");
const clearPhraseButton = document.querySelector("#clearPhraseButton");
const adminToggleButton = document.querySelector("#adminToggleButton");
const resetLocalButton = document.querySelector("#resetLocalButton");
const adminLoginPanel = document.querySelector("#adminLoginPanel");
const adminUserInput = document.querySelector("#adminUserInput");
const adminPasswordInput = document.querySelector("#adminPasswordInput");
const adminSubmitButton = document.querySelector("#adminSubmitButton");
const adminStatusText = document.querySelector("#adminStatusText");
const captureButton = document.querySelector("#captureButton");
const captureMotionButton = document.querySelector("#captureMotionButton");
const saveButton = document.querySelector("#saveButton");
const captureLetterButton = document.querySelector("#captureLetterButton");
const captureLetterMotionButton = document.querySelector("#captureLetterMotionButton");
const saveLetterButton = document.querySelector("#saveLetterButton");
const motionDelaySelect = document.querySelector("#motionDelaySelect");
const letterMotionDelaySelect = document.querySelector("#letterMotionDelaySelect");
const motionDurationSelect = document.querySelector("#motionDurationSelect");
const letterMotionDurationSelect = document.querySelector("#letterMotionDurationSelect");
const signNameInput = document.querySelector("#signNameInput");
const signScopeText = document.querySelector("#signScopeText");
const signSearchInput = document.querySelector("#signSearchInput");
const letterSelect = document.querySelector("#letterSelect");
const letterScopeText = document.querySelector("#letterScopeText");
const letterSearchInput = document.querySelector("#letterSearchInput");
const modelStatus = document.querySelector("#modelStatus");
const cameraEmpty = document.querySelector("#cameraEmpty");
const motionCountdown = document.querySelector("#motionCountdown");
const translationText = document.querySelector("#translationText");
const confidenceText = document.querySelector("#confidenceText");
const phraseText = document.querySelector("#phraseText");
const phraseSuggestionText = document.querySelector("#phraseSuggestionText");
const fpsLabel = document.querySelector("#fpsLabel");
const sampleCounter = document.querySelector("#sampleCounter");
const pendingSampleList = document.querySelector("#pendingSampleList");
const signList = document.querySelector("#signList");
const letterStatus = document.querySelector("#letterStatus");
const letterOutput = document.querySelector("#letterOutput");
const letterSampleCounter = document.querySelector("#letterSampleCounter");
const pendingLetterSampleList = document.querySelector("#pendingLetterSampleList");
const letterList = document.querySelector("#letterList");

const STORAGE_KEY = "vinculacion.lsec.samples.v1";
const LETTER_STORAGE_KEY = "vinculacion.lsec.letters.v1";
const HIDDEN_GLOBAL_SIGNS_KEY = "vinculacion.lsec.hiddenGlobalSigns.v1";
const HIDDEN_GLOBAL_LETTERS_KEY = "vinculacion.lsec.hiddenGlobalLetters.v1";
const ADMIN_TOKEN_KEY = "vinculacion.lsec.adminToken.v1";
const HOLD_TO_APPEND_MS = 1100;
const PHRASE_APPEND_THRESHOLD = 0.34;
const CUSTOM_MATCH_THRESHOLD = 0.19;
const LETTER_MATCH_THRESHOLD = 0.18;
const MOTION_LETTER_MATCH_THRESHOLD = 0.12;
const FACE_EVERY_FRAMES = 2;
const MOTION_CAPTURE_INTERVAL_MS = 90;
const MOTION_WINDOW_MS = 3200;
const MIN_MOTION_FRAMES = 4;
const MOTION_RESAMPLE_FRAMES = 12;
const SEARCH_ENABLE_THRESHOLD = 5;
const HAND_VECTOR_SIZE = 63;
const HEAD_FEATURE_SIZE = 5;
const FACE_LANDMARK_INDICES = [
  10, 33, 61, 78, 133, 152, 159, 145, 263, 291, 308, 362, 386, 374
];
const FACE_BLENDSHAPE_NAMES = [
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "jawOpen",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthPucker",
  "mouthSmileLeft",
  "mouthSmileRight"
];
const ALPHABET = [
  "A", "B", "C", "CH", "D", "E", "F", "G", "H", "I", "J", "K",
  "L", "LL", "LLL", "M", "N", "\u00d1", "O", "P", "Q", "R", "RR",
  "S", "T", "U", "V", "W", "X", "Y", "Z"
];
const MOTION_LETTERS = new Set(["J", "LL", "\u00d1", "RR"]);
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
];

let gestureRecognizer;
let faceLandmarker;
let drawingUtils;
let DrawingUtils;
let FaceLandmarker;
let FilesetResolver;
let GestureRecognizer;
let stream;
let facingMode = "user";
let running = false;
let lastVideoTime = -1;
let lastFrameAt = performance.now();
let frameIndex = 0;
let lastFaceResult = null;
let phrase = [];
let activePrediction = { label: "Esperando senia...", score: 0 };
let holdLabel = "";
let holdStart = 0;
let pendingSamples = [];
let pendingLetterSamples = [];
let customSigns = loadSigns();
let customLetters = loadLetters();
let globalSigns = [];
let globalLetters = [];
let hiddenGlobalSigns = loadStringList(HIDDEN_GLOBAL_SIGNS_KEY);
let hiddenGlobalLetters = loadStringList(HIDDEN_GLOBAL_LETTERS_KEY);
let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
let mode = "words";
let motionRecording = null;
let motionCountdownState = null;
let recentMotionFrames = [];

const baseTranslations = {
  Open_Palm: "hola",
  Closed_Fist: "si / afirmacion",
  Thumb_Up: "bien",
  Pointing_Up: "atencion",
  Victory: "dos / paz",
  Thumb_Down: "no / negativo",
  ILoveYou: "te quiero"
};

init();

async function init() {
  setControlsEnabled(false);
  updateAdminUi();
  renderPendingSamples("sign");
  renderPendingSamples("letter");
  renderSignList();
  renderLetterSelect();
  renderLetterList();
  await loadGlobalData();

  try {
    const mediaPipe = await import("./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs");
    DrawingUtils = mediaPipe.DrawingUtils;
    FaceLandmarker = mediaPipe.FaceLandmarker;
    FilesetResolver = mediaPipe.FilesetResolver;
    GestureRecognizer = mediaPipe.GestureRecognizer;

    const vision = await FilesetResolver.forVisionTasks(
      "./node_modules/@mediapipe/tasks-vision/wasm"
    );

    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "./models/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2
    });

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "./models/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true
    });

    drawingUtils = new DrawingUtils(ctx);
    modelStatus.textContent = "Modelos listos";
    setControlsEnabled(true);
  } catch (error) {
    console.error(error);
    modelStatus.textContent = "No se pudieron cargar los modelos";
    translationText.textContent = "No cargo MediaPipe";
    confidenceText.textContent = "Revisa internet, recarga la pagina o mira la consola del navegador.";
  }
}

function setControlsEnabled(enabled) {
  cameraButton.disabled = !enabled;
  flipButton.disabled = !enabled;
  captureButton.disabled = !enabled;
  captureMotionButton.disabled = !enabled;
  saveButton.disabled = !enabled;
  captureLetterButton.disabled = !enabled;
  captureLetterMotionButton.disabled = !enabled;
  saveLetterButton.disabled = !enabled;
}

cameraButton.addEventListener("click", async () => {
  if (running) {
    stopCamera();
    return;
  }
  await startCamera();
});

flipButton.addEventListener("click", async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  if (running) {
    stopCamera();
    await startCamera();
  }
});

clearPhraseButton.addEventListener("click", () => {
  phrase = [];
  updatePhraseViews();
});

resetLocalButton.addEventListener("click", async () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LETTER_STORAGE_KEY);
  localStorage.removeItem(HIDDEN_GLOBAL_SIGNS_KEY);
  localStorage.removeItem(HIDDEN_GLOBAL_LETTERS_KEY);
  customSigns = [];
  customLetters = [];
  hiddenGlobalSigns = [];
  hiddenGlobalLetters = [];
  pendingSamples = [];
  pendingLetterSamples = [];
  phrase = [];
  updatePhraseViews();
  sampleCounter.textContent = "0 muestras listas";
  letterSampleCounter.textContent = "0 muestras de letra";
  renderPendingSamples("sign");
  renderPendingSamples("letter");
  await loadGlobalData();
  adminStatusText.textContent = "Datos locales reiniciados. Se mantienen las muestras globales del servidor.";
});

signSearchInput.addEventListener("input", renderSignList);
letterSearchInput.addEventListener("input", renderLetterList);

adminToggleButton.addEventListener("click", () => {
  if (adminToken) {
    adminToken = "";
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    updateAdminUi();
    return;
  }
  adminLoginPanel.classList.toggle("hidden");
});

adminSubmitButton.addEventListener("click", async () => {
  await loginAdmin();
});

adminPasswordInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") await loginAdmin();
});

modeButton.addEventListener("click", () => {
  mode = mode === "words" ? "letters" : "words";
  modeButton.textContent = mode === "words" ? "Modo: palabras" : "Modo: abecedario";
  phrase = [];
  updatePhraseViews();
});

captureButton.addEventListener("click", () => {
  const vector = currentVector();
  if (!vector) {
    sampleCounter.textContent = "No hay mano ni rostro detectado para capturar";
    return;
  }
  pendingSamples.push(withSampleTimestamp({ kind: "pose", vector }));
  sampleCounter.textContent = `${pendingSamples.length} muestras listas`;
  renderPendingSamples("sign");
});

captureMotionButton.addEventListener("click", () => {
  toggleMotionCapture("sign");
});

captureLetterButton.addEventListener("click", () => {
  const vector = currentVector();
  if (!vector) {
    letterSampleCounter.textContent = "No hay mano ni rostro detectado para capturar";
    return;
  }
  pendingLetterSamples.push(withSampleTimestamp({ kind: "pose", vector }));
  letterSampleCounter.textContent = `${pendingLetterSamples.length} muestras de letra`;
  renderPendingSamples("letter");
});

captureLetterMotionButton.addEventListener("click", () => {
  toggleMotionCapture("letter");
});

saveLetterButton.addEventListener("click", async () => {
  const letter = letterSelect.value;
  if (!letter || pendingLetterSamples.length === 0) {
    letterSampleCounter.textContent = "Elige una letra y captura al menos 1 muestra";
    return;
  }
  const item = { label: letter, samples: [...pendingLetterSamples] };
  if (adminToken) {
    const ok = await saveGlobalItem("letters", item);
    if (!ok) return;
  } else {
    const existing = customLetters.find((entry) => entry.label === letter);
    if (existing) {
      existing.samples.push(...pendingLetterSamples);
    } else {
      customLetters.push(item);
    }
    saveLetters(customLetters);
  }
  pendingLetterSamples = [];
  letterSampleCounter.textContent = "0 muestras de letra";
  renderPendingSamples("letter");
  renderLetterList();
});

saveButton.addEventListener("click", async () => {
  const name = signNameInput.value.trim().toLowerCase();
  if (!name || pendingSamples.length === 0) {
    sampleCounter.textContent = "Escribe un nombre y captura al menos 1 muestra";
    return;
  }
  const item = { label: name, samples: [...pendingSamples] };
  if (adminToken) {
    const ok = await saveGlobalItem("signs", item);
    if (!ok) return;
  } else {
    const existing = customSigns.find((sign) => sign.label === name);
    if (existing) {
      existing.samples.push(...pendingSamples);
    } else {
      customSigns.push(item);
    }
    saveSigns(customSigns);
  }
  pendingSamples = [];
  signNameInput.value = "";
  sampleCounter.textContent = "0 muestras listas";
  renderPendingSamples("sign");
  renderSignList();
});

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    running = true;
    cameraButton.textContent = "Detener camara";
    cameraEmpty.classList.add("hidden");
    requestAnimationFrame(predictFrame);
  } catch (error) {
    console.error(error);
    modelStatus.textContent = "Permiso de camara denegado o no disponible";
  }
}

function stopCamera() {
  running = false;
  cancelMotionCountdown();
  stopMotionCapture(true);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  cameraButton.textContent = "Iniciar camara";
  cameraEmpty.classList.remove("hidden");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function predictFrame(now) {
  if (!running) return;

  resizeCanvas();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const gestureResult = gestureRecognizer.recognizeForVideo(video, now);
    frameIndex += 1;
    const faceResult = frameIndex % FACE_EVERY_FRAMES === 0
      ? faceLandmarker.detectForVideo(video, now)
      : lastFaceResult;
    if (frameIndex % FACE_EVERY_FRAMES === 0) lastFaceResult = faceResult;
    window.lastHandLandmarks = gestureResult.landmarks ?? window.lastHandLandmarks;
    window.lastFaceResult = faceResult ?? window.lastFaceResult;
    const fullVector = currentVector(gestureResult, faceResult);
    trackMotionFrame(fullVector, now);
    renderDetections(gestureResult, faceResult);
    updatePrediction(gestureResult, faceResult, now);
    updateFps(now);
  }

  requestAnimationFrame(predictFrame);
}

function resizeCanvas() {
  const width = video.videoWidth || canvas.clientWidth;
  const height = video.videoHeight || canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function renderDetections(gestureResult, faceResult) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(-1, 1);
  ctx.translate(-canvas.width, 0);

  for (const landmarks of gestureResult.landmarks ?? []) {
    drawHandLines(landmarks);
    drawingUtils.drawLandmarks(landmarks, {
      color: "#f2c14e",
      lineWidth: 2,
      radius: 5
    });
  }

  for (const landmarks of faceResult?.faceLandmarks ?? []) {
    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
      color: "rgba(244, 242, 237, 0.22)",
      lineWidth: 1
    });
    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
      color: "#f2c14e",
      lineWidth: 2
    });
  }

  ctx.restore();
}

function drawHandLines(landmarks) {
  ctx.save();
  ctx.strokeStyle = "#2ec4b6";
  ctx.lineWidth = Math.max(3, canvas.width * 0.004);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [start, end] of HAND_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    ctx.beginPath();
    ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
    ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
    ctx.stroke();
  }

  ctx.restore();
}

function updatePrediction(gestureResult, faceResult, now) {
  const fullVector = currentVector(gestureResult, faceResult);
  const letter = classifyLetter(gestureResult, fullVector);
  letterOutput.textContent = letter?.label ?? "--";
  letterStatus.textContent = letter ? `${Math.round(letter.score * 100)}%` : "LSEC";

  if (mode === "letters") {
    activePrediction = letter
      ? { label: letter.label, score: letter.score }
      : { label: "Esperando letra...", score: 0 };
    translationText.textContent = activePrediction.label;
    confidenceText.textContent = `Confianza: ${Math.round(activePrediction.score * 100)}%`;
    maybeAppendPhrase(activePrediction.label, now, activePrediction.score);
    return;
  }

  const custom = classifyCustom(fullVector, gestureResult);
  const canned = classifyBaseGesture(gestureResult);
  const expression = classifyExpression(faceResult);

  if (custom && custom.score > CUSTOM_MATCH_THRESHOLD) {
    activePrediction = custom;
  } else if (canned) {
    activePrediction = canned;
  } else if (expression) {
    activePrediction = expression;
  } else {
    activePrediction = { label: "Esperando senia...", score: 0 };
  }

  translationText.textContent = activePrediction.label;
  confidenceText.textContent = `Confianza: ${Math.round(activePrediction.score * 100)}%`;
  maybeAppendPhrase(activePrediction.label, now, activePrediction.score);
}

function classifyBaseGesture(gestureResult) {
  const category = gestureResult.gestures?.[0]?.[0];
  if (!category || category.categoryName === "None") return null;
  return {
    label: baseTranslations[category.categoryName] ?? category.categoryName,
    score: category.score ?? 0
  };
}

function classifyExpression(faceResult) {
  const blendshapes = faceResult?.faceBlendshapes?.[0]?.categories ?? [];
  const smile = blendshapes.find((item) => item.categoryName === "mouthSmileLeft")?.score ?? 0;
  const brow = blendshapes.find((item) => item.categoryName === "browInnerUp")?.score ?? 0;
  if (smile > 0.55) return { label: "expresion: sonrisa", score: smile };
  if (brow > 0.55) return { label: "expresion: pregunta", score: brow };
  return null;
}

function classifyLetter(gestureResult, fullVector = null) {
  const trained = classifyCustomLetter(fullVector, gestureResult);
  if (trained?.accepted) return trained;

  const landmarks = gestureResult?.landmarks?.[0];
  if (!landmarks) return null;

  return classifyLetterByShape(gestureResult.landmarks);
}

function classifyCustomLetter(vector, gestureResult = null) {
  const letters = [...visibleGlobalLetters(), ...customLetters];
  if (!vector || letters.length === 0) return null;
  let bestPose = { label: "", distance: Infinity };
  let bestMotion = { label: "", distance: Infinity };

  for (const letter of letters) {
    for (const sample of letter.samples) {
      const isMotion = sample?.kind === "motion" && Array.isArray(sample.frames);
      const distance = sampleDistance(vector, sample, gestureResult, null, { useLetterMotion: isMotion });
      if (isMotion) {
        if (distance < bestMotion.distance) bestMotion = { label: letter.label, distance };
      } else if (distance < bestPose.distance) {
        bestPose = { label: letter.label, distance };
      }
    }
  }

  const motionScore = Math.max(0, 1 - bestMotion.distance / 3.2);
  if (MOTION_LETTERS.has(bestMotion.label) && motionScore > MOTION_LETTER_MATCH_THRESHOLD) {
    return { label: bestMotion.label, score: motionScore, accepted: true };
  }
  if (motionScore > LETTER_MATCH_THRESHOLD + 0.04) {
    return { label: bestMotion.label, score: motionScore, accepted: true };
  }

  const poseScore = Math.max(0, 1 - bestPose.distance / 2.8);
  if (poseScore > LETTER_MATCH_THRESHOLD) {
    return { label: bestPose.label, score: poseScore, accepted: true };
  }

  return null;
}

function classifyLetterByShape(hands) {
  const landmarks = hands[0];
  const secondHand = hands[1];
  const fingers = fingerStates(landmarks);
  const thumbUp = fingers.thumb;
  const indexUp = fingers.index;
  const middleUp = fingers.middle;
  const ringUp = fingers.ring;
  const pinkyUp = fingers.pinky;
  const extendedCount = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;
  const thumbIndexDistance = distance2d(landmarks[4], landmarks[8]);
  const thumbMiddleDistance = distance2d(landmarks[4], landmarks[12]);
  const indexMiddleDistance = distance2d(landmarks[8], landmarks[12]);

  let label = null;
  let score = 0.55;

  if (secondHand && isLShape(landmarks) && isLShape(secondHand)) label = "LLL";
  else if (!thumbUp && extendedCount === 0) label = "A";
  else if (!thumbUp && extendedCount === 4) label = "B";
  else if (looksLikeC(landmarks)) label = "C";
  else if (extendedCount === 4 && thumbIndexDistance < 0.09) label = "F";
  else if (indexUp && middleUp && !ringUp && !pinkyUp && indexMiddleDistance > 0.06) label = "V";
  else if (indexUp && middleUp && ringUp && !pinkyUp) label = "W";
  else if (indexUp && !middleUp && !ringUp && !pinkyUp) label = "D";
  else if (!indexUp && !middleUp && !ringUp && pinkyUp) label = "I";
  else if (thumbUp && !indexUp && !middleUp && !ringUp && pinkyUp) label = "Y";
  else if (isLShape(landmarks)) label = "L";
  else if (!thumbUp && !indexUp && middleUp && !ringUp && !pinkyUp) label = "E";
  else if (!thumbUp && indexUp && middleUp && ringUp && pinkyUp) label = "B";
  else if (extendedCount === 0 && thumbIndexDistance < 0.08) label = "O";
  else if (indexUp && middleUp && !ringUp && !pinkyUp && thumbMiddleDistance < 0.12) label = "K";
  else if (thumbUp && indexUp && middleUp && !ringUp && !pinkyUp) label = "CH";

  if (!label) return null;
  return { label, score };
}

function isLShape(landmarks) {
  const fingers = fingerStates(landmarks);
  return fingers.thumb && fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
}

function looksLikeC(landmarks) {
  const fingers = fingerStates(landmarks);
  const thumbIndexDistance = distance2d(landmarks[4], landmarks[8]);
  const thumbPinkyDistance = distance2d(landmarks[4], landmarks[20]);
  return !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky
    && thumbIndexDistance > 0.09
    && thumbPinkyDistance > 0.14;
}

function fingerStates(landmarks) {
  const handedness = landmarks[17].x < landmarks[5].x ? "right" : "left";
  return {
    thumb: handedness === "right" ? landmarks[4].x < landmarks[3].x : landmarks[4].x > landmarks[3].x,
    index: landmarks[8].y < landmarks[6].y,
    middle: landmarks[12].y < landmarks[10].y,
    ring: landmarks[16].y < landmarks[14].y,
    pinky: landmarks[20].y < landmarks[18].y
  };
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function currentHandVector(gestureResult = null) {
  const landmarks = gestureResult?.landmarks?.[0] ?? window.lastHandLandmarks?.[0];
  if (!landmarks) return null;
  window.lastHandLandmarks = gestureResult?.landmarks ?? window.lastHandLandmarks;
  return normalizeHand(landmarks);
}

function normalizeHand(landmarks) {
  const wrist = landmarks[0];
  const middle = landmarks[9];
  const scale = Math.hypot(middle.x - wrist.x, middle.y - wrist.y, middle.z - wrist.z) || 1;
  return landmarks.flatMap((point) => [
    (point.x - wrist.x) / scale,
    (point.y - wrist.y) / scale,
    (point.z - wrist.z) / scale
  ]);
}

function currentVector(gestureResult = null, faceResult = null) {
  const hands = gestureResult?.landmarks ?? window.lastHandLandmarks ?? [];
  const face = faceResult ?? window.lastFaceResult ?? null;
  if (gestureResult?.landmarks) window.lastHandLandmarks = gestureResult.landmarks;
  if (faceResult) window.lastFaceResult = faceResult;

  const sortedHands = [...hands].sort((a, b) => (a[0]?.x ?? 0) - (b[0]?.x ?? 0));
  const firstHand = normalizeOptionalHand(sortedHands[0]);
  const secondHand = normalizeOptionalHand(sortedHands[1]);
  const faceVector = normalizeFace(face);

  if (!firstHand.present && !secondHand.present && !faceVector.present) return null;
  return [
    Number(firstHand.present),
    ...firstHand.values,
    Number(secondHand.present),
    ...secondHand.values,
    Number(faceVector.present),
    ...faceVector.values
  ];
}

function toggleMotionCapture(type) {
  if (motionCountdownState?.type === type) {
    cancelMotionCountdown();
    return;
  }
  if (motionRecording?.type === type) {
    stopMotionCapture(false);
    return;
  }
  if (motionRecording) stopMotionCapture(true);
  if (motionCountdownState) cancelMotionCountdown();
  if (!running) {
    const target = type === "letter" ? letterSampleCounter : sampleCounter;
    target.textContent = "Inicia la camara antes de grabar movimiento";
    return;
  }

  const delay = motionDelayFor(type);
  if (delay > 0) {
    startMotionCountdown(type, delay);
    return;
  }

  beginMotionRecording(type);
}

function beginMotionRecording(type) {
  const duration = motionDurationFor(type);
  motionRecording = {
    type,
    startedAt: performance.now(),
    lastFrameAt: 0,
    frames: [],
    durationMs: duration * 1000,
    stopTimer: null
  };
  const button = type === "letter" ? captureLetterMotionButton : captureMotionButton;
  button.classList.add("recording");
  button.textContent = duration > 0 ? "Grabando..." : "Detener movimiento";
  if (duration > 0) {
    motionCountdown.classList.remove("hidden");
    motionCountdown.textContent = String(duration);
    motionRecording.stopTimer = setTimeout(() => stopMotionCapture(false), duration * 1000);
  }
  updateMotionStatus(performance.now());
}

function startMotionCountdown(type, seconds) {
  const button = type === "letter" ? captureLetterMotionButton : captureMotionButton;
  const counter = type === "letter" ? letterSampleCounter : sampleCounter;
  const timers = [];
  motionCountdownState = { type, timers };
  button.classList.add("recording");
  button.textContent = "Cancelar espera";
  motionCountdown.classList.remove("hidden");

  for (let remaining = seconds; remaining >= 0; remaining -= 1) {
    timers.push(setTimeout(() => {
      if (!motionCountdownState || motionCountdownState.type !== type) return;
      motionCountdown.textContent = String(remaining);
      counter.textContent = remaining > 0
        ? `Grabacion inicia en ${remaining} s`
        : "Grabando movimiento...";
    }, (seconds - remaining) * 1000));
  }

  timers.push(setTimeout(() => {
    if (!motionCountdownState || motionCountdownState.type !== type) return;
    motionCountdownState = null;
    motionCountdown.classList.add("hidden");
    button.classList.remove("recording");
    beginMotionRecording(type);
  }, seconds * 1000 + 350));
}

function cancelMotionCountdown() {
  if (!motionCountdownState) return;
  const { type, timers } = motionCountdownState;
  for (const timer of timers) clearTimeout(timer);
  motionCountdownState = null;
  motionCountdown.classList.add("hidden");
  const button = type === "letter" ? captureLetterMotionButton : captureMotionButton;
  const counter = type === "letter" ? letterSampleCounter : sampleCounter;
  button.classList.remove("recording");
  button.textContent = "Captura con movimiento";
  counter.textContent = type === "letter"
    ? `${pendingLetterSamples.length} muestras de letra`
    : `${pendingSamples.length} muestras listas`;
}

function motionDelayFor(type) {
  const select = type === "letter" ? letterMotionDelaySelect : motionDelaySelect;
  return Math.max(0, Math.min(10, Number(select.value) || 0));
}

function motionDurationFor(type) {
  const select = type === "letter" ? letterMotionDurationSelect : motionDurationSelect;
  return Math.max(0, Math.min(10, Number(select.value) || 0));
}

function stopMotionCapture(cancelled) {
  if (!motionRecording) return;
  const recording = motionRecording;
  motionRecording = null;
  if (recording.stopTimer) clearTimeout(recording.stopTimer);
  motionCountdown.classList.add("hidden");

  const button = recording.type === "letter" ? captureLetterMotionButton : captureMotionButton;
  const counter = recording.type === "letter" ? letterSampleCounter : sampleCounter;
  const pending = recording.type === "letter" ? pendingLetterSamples : pendingSamples;

  button.classList.remove("recording");
  button.textContent = "Captura con movimiento";

  if (cancelled) {
    counter.textContent = recording.type === "letter"
      ? `${pendingLetterSamples.length} muestras de letra`
      : `${pendingSamples.length} muestras listas`;
    return;
  }

  if (recording.frames.length < MIN_MOTION_FRAMES) {
    counter.textContent = "Movimiento muy corto o sin tracking suficiente";
    return;
  }

  pending.push({
    kind: "motion",
    ...sampleTimestamp(),
    duration: recording.frames.at(-1).time - recording.frames[0].time,
    frames: recording.frames.map((frame) => frame.vector)
  });
  counter.textContent = recording.type === "letter"
    ? `${pending.length} muestras de letra`
    : `${pending.length} muestras listas`;
  renderPendingSamples(recording.type === "letter" ? "letter" : "sign");
}

function trackMotionFrame(vector, now) {
  if (vector) {
    recentMotionFrames.push({ time: now, vector });
    recentMotionFrames = recentMotionFrames.filter((frame) => now - frame.time <= MOTION_WINDOW_MS);
  }

  if (!motionRecording) return;
  updateMotionStatus(now);
  if (!vector || now - motionRecording.lastFrameAt < MOTION_CAPTURE_INTERVAL_MS) return;
  motionRecording.frames.push({ time: now - motionRecording.startedAt, vector });
  motionRecording.lastFrameAt = now;
}

function updateMotionStatus(now) {
  if (!motionRecording) return;
  const seconds = Math.max(0, (now - motionRecording.startedAt) / 1000);
  const counter = motionRecording.type === "letter" ? letterSampleCounter : sampleCounter;
  if (motionRecording.durationMs > 0) {
    const remaining = Math.max(0, Math.ceil((motionRecording.durationMs - (now - motionRecording.startedAt)) / 1000));
    motionCountdown.classList.remove("hidden");
    motionCountdown.textContent = String(remaining);
    counter.textContent = `Grabando movimiento: ${seconds.toFixed(1)} s - termina en ${remaining} s`;
    return;
  }
  counter.textContent = `Grabando movimiento: ${seconds.toFixed(1)} s`;
}

function normalizeOptionalHand(landmarks) {
  if (!landmarks) {
    return { present: false, values: Array(HAND_VECTOR_SIZE).fill(0) };
  }
  return { present: true, values: normalizeHand(landmarks) };
}

function normalizeFace(faceResult) {
  const landmarks = faceResult?.faceLandmarks?.[0];
  const blendshapes = faceResult?.faceBlendshapes?.[0]?.categories ?? [];
  const blendshapeMap = new Map(blendshapes.map((item) => [item.categoryName, item.score ?? 0]));
  const emptyHead = Array(HEAD_FEATURE_SIZE).fill(0);
  const emptyLandmarks = Array(FACE_LANDMARK_INDICES.length * 3).fill(0);
  const emptyBlendshapes = Array(FACE_BLENDSHAPE_NAMES.length).fill(0);

  if (!landmarks) {
    return { present: false, values: [...emptyHead, ...emptyLandmarks, ...emptyBlendshapes] };
  }

  const center = landmarks[1] ?? landmarks[0];
  const chin = landmarks[152] ?? center;
  const leftEye = landmarks[33] ?? center;
  const rightEye = landmarks[263] ?? center;
  const forehead = landmarks[10] ?? center;
  const scale = Math.hypot(chin.x - center.x, chin.y - center.y, chin.z - center.z) || 1;
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
    z: (leftEye.z + rightEye.z) / 2
  };
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y, rightEye.z - leftEye.z) || scale;
  const headValues = [
    (center.x - eyeCenter.x) / eyeDistance,
    (center.y - eyeCenter.y) / scale,
    (center.z - eyeCenter.z) / eyeDistance,
    Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
    (forehead.y - chin.y) / scale
  ];
  const landmarkValues = FACE_LANDMARK_INDICES.flatMap((index) => {
    const point = landmarks[index] ?? center;
    return [
      (point.x - center.x) / scale,
      (point.y - center.y) / scale,
      (point.z - center.z) / scale
    ];
  });
  const blendshapeValues = FACE_BLENDSHAPE_NAMES.map((name) => blendshapeMap.get(name) ?? 0);

  return { present: true, values: [...headValues, ...landmarkValues, ...blendshapeValues] };
}

function classifyCustom(vector, gestureResult = null) {
  const signs = [...visibleGlobalSigns(), ...customSigns];
  if (!vector || signs.length === 0) return null;
  let best = { label: "", distance: Infinity };
  const legacyHandVector = currentHandVector(gestureResult);

  for (const sign of signs) {
    for (const sample of sign.samples) {
      const distance = sampleDistance(vector, sample, gestureResult, legacyHandVector, { useHeadMotion: true });
      if (distance < best.distance) best = { label: sign.label, distance };
    }
  }

  const score = Math.max(0, 1 - best.distance / 2.8);
  return { label: best.label, score };
}

function sampleDistance(vector, sample, gestureResult = null, legacyHandVector = null, options = {}) {
  if (sample?.kind === "motion" && Array.isArray(sample.frames)) {
    return motionDistance(currentMotionSequence(), sample.frames, options);
  }

  const sampleVector = sample?.kind === "pose" && Array.isArray(sample.vector)
    ? sample.vector
    : sample;
  const handVector = legacyHandVector ?? currentHandVector(gestureResult);
  const candidateVector = Array.isArray(sampleVector) && sampleVector.length === HAND_VECTOR_SIZE && handVector
    ? handVector
    : vector;

  if (!candidateVector || !Array.isArray(sampleVector)) return Infinity;
  return euclideanDistance(candidateVector, sampleVector);
}

function currentMotionSequence() {
  return recentMotionFrames.map((frame) => frame.vector);
}

function motionDistance(currentFrames, sampleFrames, options = {}) {
  if (!currentFrames || !sampleFrames || currentFrames.length < MIN_MOTION_FRAMES) return Infinity;
  const current = resampleFrames(currentFrames, MOTION_RESAMPLE_FRAMES);
  const sample = resampleFrames(sampleFrames, MOTION_RESAMPLE_FRAMES);
  let total = 0;

  for (let index = 0; index < MOTION_RESAMPLE_FRAMES; index += 1) {
    total += options.useLetterMotion
      ? letterMotionFrameDistance(current[index], sample[index])
      : options.useHeadMotion
      ? signMotionFrameDistance(current[index], sample[index])
      : euclideanDistance(current[index], sample[index]);
  }
  return total / MOTION_RESAMPLE_FRAMES;
}

function letterMotionFrameDistance(currentFrame, sampleFrame) {
  const baseDistance = euclideanDistance(currentFrame, sampleFrame);
  const handDistance = euclideanDistance(handMotionFeatures(currentFrame), handMotionFeatures(sampleFrame));
  if (!Number.isFinite(handDistance)) return baseDistance;
  return (baseDistance * 0.45) + (handDistance * 0.55);
}

function handMotionFeatures(vector) {
  if (!Array.isArray(vector)) return [];
  const firstHandPresent = vector[0] === 1;
  const secondHandStart = 1 + HAND_VECTOR_SIZE;
  const secondHandPresent = vector[secondHandStart] === 1;
  if (firstHandPresent) return vector.slice(1, 1 + HAND_VECTOR_SIZE);
  if (secondHandPresent) return vector.slice(secondHandStart + 1, secondHandStart + 1 + HAND_VECTOR_SIZE);
  return Array(HAND_VECTOR_SIZE).fill(0);
}

function signMotionFrameDistance(currentFrame, sampleFrame) {
  const baseDistance = euclideanDistance(currentFrame, sampleFrame);
  const headDistance = euclideanDistance(headFeatures(currentFrame), headFeatures(sampleFrame));
  if (!Number.isFinite(headDistance)) return baseDistance;
  return (baseDistance * 0.55) + (headDistance * 0.45);
}

function headFeatures(vector) {
  if (!Array.isArray(vector)) return [];
  const faceStart = 2 + (HAND_VECTOR_SIZE * 2);
  if (vector[faceStart] !== 1) return Array(HEAD_FEATURE_SIZE).fill(0);
  return vector.slice(faceStart + 1, faceStart + 1 + HEAD_FEATURE_SIZE);
}

function resampleFrames(frames, targetCount) {
  if (frames.length === targetCount) return frames;
  if (frames.length === 1) return Array(targetCount).fill(frames[0]);

  const result = [];
  for (let index = 0; index < targetCount; index += 1) {
    const sourceIndex = Math.round((index / (targetCount - 1)) * (frames.length - 1));
    result.push(frames[sourceIndex]);
  }
  return result;
}

function euclideanDistance(a, b) {
  const length = Math.min(a.length, b.length);
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    const diff = a[index] - b[index];
    total += diff * diff;
  }
  const lengthPenalty = Math.abs(a.length - b.length) / Math.max(a.length, b.length);
  return Math.sqrt(total / length) + lengthPenalty;
}

function maybeAppendPhrase(label, now, score = 0) {
  const token = cleanPhraseToken(label);
  if (
    label === "Esperando senia..." ||
    label === "Esperando letra..." ||
    label.startsWith("expresion:") ||
    !token ||
    score < PHRASE_APPEND_THRESHOLD
  ) {
    holdLabel = "";
    holdStart = 0;
    return;
  }

  if (label !== holdLabel) {
    holdLabel = label;
    holdStart = now;
    return;
  }

  if (now - holdStart > HOLD_TO_APPEND_MS && phrase.at(-1) !== token) {
    phrase.push(token);
    updatePhraseViews();
    holdStart = now + 999999;
  }
}

function updatePhraseViews() {
  const rawPhrase = phrase.join(" ");
  phraseText.textContent = rawPhrase;
  if (!phraseSuggestionText) return;
  const suggestion = phrase.length > 0 ? buildPhraseSuggestion(phrase) : "";
  const suggestionBox = phraseSuggestionText.closest(".phrase-suggestion");
  if (!suggestion) {
    phraseSuggestionText.textContent = "";
    suggestionBox?.classList.add("hidden");
    return;
  }
  phraseSuggestionText.textContent = suggestion;
  suggestionBox?.classList.remove("hidden");
}

function buildPhraseSuggestion(tokens) {
  const cleaned = tokens
    .map(cleanPhraseToken)
    .filter(Boolean)
    .filter((token, index, list) => token !== list[index - 1])
    .filter((token, index, list) => !isLikelyNoiseToken(token, index, list));
  if (cleaned.length === 0) return "";
  const original = tokens.map(cleanPhraseToken).filter(Boolean).join(" ");
  const phraseTextValue = cleaned.join(" ");
  if (phraseTextValue === original) return "";
  return `${phraseTextValue.charAt(0).toUpperCase()}${phraseTextValue.slice(1)}.`;
}

function isLikelyNoiseToken(token, index, list) {
  const shortFillers = new Set(["si", "bien", "hola"]);
  if (list.length <= 2) return false;
  return shortFillers.has(token) && index > 0 && index < list.length - 1;
}

function cleanPhraseToken(label) {
  return String(label)
    .replace(/^expresion:\s*/i, "")
    .split("/")
    .at(0)
    .trim()
    .toLowerCase();
}

function updateFps(now) {
  const fps = 1000 / Math.max(1, now - lastFrameAt);
  lastFrameAt = now;
  fpsLabel.textContent = `${Math.round(fps)} fps`;
}

async function loadGlobalData() {
  try {
    const response = await fetch("/api/global-data");
    if (!response.ok) throw new Error("No se pudo cargar el dataset global");
    const data = await response.json();
    globalSigns = Array.isArray(data.signs) ? data.signs : [];
    globalLetters = Array.isArray(data.letters) ? data.letters : [];
    renderSignList();
    renderLetterList();
  } catch (error) {
    console.warn(error);
    adminStatusText.textContent = "No se pudo cargar el dataset global; el modo local sigue disponible.";
  }
}

async function loginAdmin() {
  try {
    const response = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: adminUserInput.value.trim(),
        password: adminPasswordInput.value
      })
    });
    const data = await response.json();
    if (!response.ok) {
      adminStatusText.textContent = data.error ?? "No se pudo iniciar sesion";
      return;
    }

    adminToken = data.token;
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    adminUserInput.value = "";
    adminPasswordInput.value = "";
    updateAdminUi();
  } catch (error) {
    console.error(error);
    adminStatusText.textContent = "No se pudo conectar con el servidor de administracion";
  }
}

async function saveGlobalItem(type, item) {
  try {
    const response = await fetch("/api/global-data", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ type, item })
    });
    const data = await response.json();
    if (!response.ok) {
      const counter = type === "letters" ? letterSampleCounter : sampleCounter;
      counter.textContent = data.error ?? "No se pudo guardar globalmente";
      return false;
    }

    globalSigns = Array.isArray(data.signs) ? data.signs : [];
    globalLetters = Array.isArray(data.letters) ? data.letters : [];
    return true;
  } catch (error) {
    console.error(error);
    const counter = type === "letters" ? letterSampleCounter : sampleCounter;
    counter.textContent = "No se pudo conectar para guardar globalmente";
    return false;
  }
}

async function deleteGlobalItem(type, label) {
  try {
    const response = await fetch(`/api/global-data?type=${type}&label=${encodeURIComponent(label)}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const data = await response.json();
    if (!response.ok) {
      adminStatusText.textContent = data.error ?? "No se pudo borrar globalmente";
      return;
    }
    globalSigns = Array.isArray(data.signs) ? data.signs : [];
    globalLetters = Array.isArray(data.letters) ? data.letters : [];
    renderSignList();
    renderLetterList();
  } catch (error) {
    console.error(error);
    adminStatusText.textContent = "No se pudo conectar para borrar globalmente";
  }
}

async function deleteGlobalSample(type, label, sampleIndex) {
  try {
    const response = await fetch(`/api/global-data?type=${type}&label=${encodeURIComponent(label)}&sampleIndex=${sampleIndex}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const data = await response.json();
    if (!response.ok) {
      adminStatusText.textContent = data.error ?? "No se pudo borrar la muestra global";
      return;
    }
    globalSigns = Array.isArray(data.signs) ? data.signs : [];
    globalLetters = Array.isArray(data.letters) ? data.letters : [];
    renderSignList();
    renderLetterList();
  } catch (error) {
    console.error(error);
    adminStatusText.textContent = "No se pudo conectar para borrar la muestra global";
  }
}

function updateAdminUi() {
  const isAdmin = Boolean(adminToken);
  adminLoginPanel.classList.toggle("hidden", isAdmin);
  adminToggleButton.textContent = isAdmin ? "Salir de administrador" : "Inicio de sesion administrador";
  adminStatusText.textContent = isAdmin
    ? "Modo administrador: las nuevas muestras se guardan globalmente."
    : "Modo local: tus cambios solo quedan en esta computadora.";
  signScopeText.textContent = isAdmin ? "Guardado global" : "Guardado local";
  letterScopeText.textContent = isAdmin ? "Guardado global" : "Guardado local";
  renderSignList();
  renderLetterList();
}

function withSampleTimestamp(sample) {
  return { ...sample, ...sampleTimestamp() };
}

function sampleTimestamp(date = new Date()) {
  return {
    capturedAt: date.toISOString(),
    capturedAtLabel: date.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  };
}

function sampleTimeLabel(sample) {
  if (sample?.capturedAtLabel) return sample.capturedAtLabel;
  if (sample?.capturedAt) {
    const date = new Date(sample.capturedAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }
  }
  return "sin hora";
}

function renderPendingSamples(type) {
  const list = type === "letter" ? pendingLetterSampleList : pendingSampleList;
  const samples = type === "letter" ? pendingLetterSamples : pendingSamples;
  const counter = type === "letter" ? letterSampleCounter : sampleCounter;
  if (!list) return;

  list.innerHTML = "";
  if (samples.length === 0) return;

  samples.forEach((sample, index) => {
    const item = document.createElement("div");
    item.className = "sample-chip";
    const text = document.createElement("span");
    text.textContent = `Muestra ${index + 1} - ${sampleTimeLabel(sample)}`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Quitar";
    removeButton.addEventListener("click", () => {
      samples.splice(index, 1);
      counter.textContent = type === "letter"
        ? `${samples.length} muestras de letra`
        : `${samples.length} muestras listas`;
      renderPendingSamples(type);
    });
    item.append(text, removeButton);
    list.append(item);
  });
}

function renderSignList() {
  signList.innerHTML = "";
  const allSigns = [
    ...visibleGlobalSigns().map((item) => ({ ...item, scope: "global" })),
    ...customSigns.map((item) => ({ ...item, scope: "local" }))
  ];
  const canSearch = allSigns.length > 0;
  signSearchInput.disabled = !canSearch;
  if (!canSearch) signSearchInput.value = "";

  if (allSigns.length === 0) {
    signList.innerHTML = '<p class="helper">Aun no hay senias ecuatorianas guardadas.</p>';
    return;
  }

  const query = signSearchInput.value.trim().toLowerCase();
  const visibleSigns = query
    ? allSigns.filter((sign) => sign.label.toLowerCase().includes(query))
    : allSigns;
  visibleSigns.sort(compareByLabel);

  if (visibleSigns.length === 0) {
    signList.innerHTML = '<p class="helper">No hay senias que coincidan con la busqueda.</p>';
    return;
  }

  for (const sign of visibleSigns) {
    const chip = document.createElement("details");
    chip.className = "sign-chip saved-entry";
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.innerHTML = `${sign.label} (${sign.samples.length}) <small>${sign.scope}</small>`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Borrar";
    removeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeSignEntry(sign);
    });
    summary.append(title, removeButton);
    chip.append(summary, renderSavedSamples("signs", sign));
    signList.append(chip);
  }
}

function removeSignEntry(sign) {
  if (sign.scope === "global") {
    if (adminToken) {
      deleteGlobalItem("signs", sign.label);
    } else {
      hiddenGlobalSigns = uniqueStrings([...hiddenGlobalSigns, sign.label]);
      saveStringList(HIDDEN_GLOBAL_SIGNS_KEY, hiddenGlobalSigns);
      adminStatusText.textContent = "Muestra global ocultada solo en este navegador.";
      renderSignList();
    }
    return;
  }
  customSigns = customSigns.filter((item) => item.label !== sign.label);
  saveSigns(customSigns);
  renderSignList();
}

function renderSavedSamples(type, entry) {
  const list = document.createElement("div");
  list.className = "saved-sample-list";
  if (!Array.isArray(entry.samples) || entry.samples.length === 0) {
    const empty = document.createElement("p");
    empty.className = "helper";
    empty.textContent = "No quedan muestras en esta entrada.";
    list.append(empty);
    return list;
  }

  entry.samples.forEach((sample, index) => {
    const item = document.createElement("div");
    item.className = "sample-chip saved-sample-chip";
    const label = document.createElement("span");
    label.textContent = `Muestra ${index + 1} - ${sampleTimeLabel(sample)}`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Quitar";
    if (entry.scope === "global" && !adminToken) {
      removeButton.disabled = true;
      removeButton.title = "Solo el administrador puede quitar muestras globales.";
    }
    removeButton.addEventListener("click", () => {
      if (entry.scope === "global") {
        if (adminToken) {
          deleteGlobalSample(type, entry.label, index);
        } else {
          adminStatusText.textContent = "En modo local solo puedes quitar tus muestras locales.";
        }
        return;
      }
      removeLocalSample(type, entry.label, index);
    });
    item.append(label, removeButton);
    list.append(item);
  });
  return list;
}

function removeLocalSample(type, label, index) {
  const collection = type === "letters" ? customLetters : customSigns;
  const entry = collection.find((item) => item.label === label);
  if (!entry || !Array.isArray(entry.samples)) return;
  entry.samples.splice(index, 1);
  const remaining = collection.filter((item) => item.samples?.length > 0);
  if (type === "letters") {
    customLetters = remaining;
    saveLetters(customLetters);
    renderLetterList();
  } else {
    customSigns = remaining;
    saveSigns(customSigns);
    renderSignList();
  }
}

function renderLetterSelect() {
  letterSelect.innerHTML = "";
  for (const letter of ALPHABET) {
    const option = document.createElement("option");
    option.value = letter;
    option.textContent = letter;
    letterSelect.append(option);
  }
}

function renderLetterList() {
  letterList.innerHTML = "";
  const allLetters = [
    ...visibleGlobalLetters().map((item) => ({ ...item, scope: "global" })),
    ...customLetters.map((item) => ({ ...item, scope: "local" }))
  ];
  const canSearch = allLetters.length > 0;
  letterSearchInput.disabled = !canSearch;
  if (!canSearch) letterSearchInput.value = "";

  if (allLetters.length === 0) {
    letterList.innerHTML = '<p class="helper">Puedes mejorar cada letra capturando tus propias muestras.</p>';
    return;
  }

  const query = letterSearchInput.value.trim().toLowerCase();
  const visibleLetters = query
    ? allLetters.filter((letter) => letter.label.toLowerCase().includes(query))
    : allLetters;
  visibleLetters.sort(compareByLabel);

  if (visibleLetters.length === 0) {
    letterList.innerHTML = '<p class="helper">No hay letras que coincidan con la busqueda.</p>';
    return;
  }

  for (const letter of visibleLetters) {
    const chip = document.createElement("details");
    chip.className = "sign-chip saved-entry";
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.innerHTML = `${letter.label} (${letter.samples.length}) <small>${letter.scope}</small>`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Borrar";
    removeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeLetterEntry(letter);
    });
    summary.append(title, removeButton);
    chip.append(summary, renderSavedSamples("letters", letter));
    letterList.append(chip);
  }
}

function removeLetterEntry(letter) {
  if (letter.scope === "global") {
    if (adminToken) {
      deleteGlobalItem("letters", letter.label);
    } else {
      hiddenGlobalLetters = uniqueStrings([...hiddenGlobalLetters, letter.label]);
      saveStringList(HIDDEN_GLOBAL_LETTERS_KEY, hiddenGlobalLetters);
      adminStatusText.textContent = "Letra global ocultada solo en este navegador.";
      renderLetterList();
    }
    return;
  }
  customLetters = customLetters.filter((item) => item.label !== letter.label);
  saveLetters(customLetters);
  renderLetterList();
}

function compareByLabel(a, b) {
  return a.label.localeCompare(b.label, "es", { sensitivity: "base", numeric: true });
}

function visibleGlobalSigns() {
  if (adminToken) return globalSigns;
  return globalSigns.filter((item) => !hiddenGlobalSigns.includes(item.label));
}

function visibleGlobalLetters() {
  if (adminToken) return globalLetters;
  return globalLetters.filter((item) => !hiddenGlobalLetters.includes(item.label));
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function loadSigns() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveSigns(signs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signs));
}

function loadLetters() {
  try {
    return JSON.parse(localStorage.getItem(LETTER_STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveLetters(letters) {
  localStorage.setItem(LETTER_STORAGE_KEY, JSON.stringify(letters));
}

function loadStringList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveStringList(key, values) {
  localStorage.setItem(key, JSON.stringify(uniqueStrings(values)));
}
