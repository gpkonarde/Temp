const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const rCanvas = document.getElementById("recordedCanvas");
const rCtx = recordedCanvas.getContext("2d");
const captureButton = document.getElementById("captureBtn"); // Capture button
const infoContainer = document.getElementById("infoContainer"); // Info container to show detected objects
const detectedObjectsList = document.getElementById("detectedObjectsList");
const messagesContainer = document.getElementById("messagesContainer");
const btnGrid = document.getElementById("btnGrid");

let points = [];
let lastDistance = Infinity; // Initialize last distance as a large value
let clapThreshold = 150; // Distance threshold for detecting a clap
let isRecording = false; // State to check if recording is active
let recordedKeypoints = []; // Array to store recorded keypoints
let playbackInterval;
const recordButton = document.getElementById("recordBtn"); // Record button

recordButton.addEventListener("click", async () => {
  if (!isRecording) {
    // Start recording
    isRecording = true;
    recordedKeypoints = []; // Clear previous recordings
    recordButton.textContent = "Stop Recording";
    console.log("Recording started...");

    // Start a loop to continuously capture keypoints while recording
    await startRecording();
  } else {
    // Stop recording
    isRecording = false;
    recordButton.textContent = "Start Recording";
    console.log("Recording stopped...");
  }
});

// Function to continuously capture keypoints while recording
async function startRecording() {
  const startTime = Date.now();
  while (isRecording) {
    const poses = await detector.estimatePoses(video);

    if (poses.length > 0) {
      const keypoints = poses[0].keypoints;
      const timeStamp = Date.now() - startTime;
      recordedKeypoints.push({ keypoints, timeStamp }); // Store keypoints in the array
    }
    await new Promise((resolve) => setTimeout(resolve, 100)); // Adjust the delay as needed (100ms here)
  }
  saveJson({ frames: recordedKeypoints });
}

// Main function to set up the camera and load the model
async function main() {
  await loadBlazePose();
}

// Setup the camera stream
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

// Load MoveNet model
async function loadBlazePose() {
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.BlazePose,
    {
      runtime: "mediapipe",
      solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/pose",
      modelType: "full",
    }
  );
  console.log("BlazePose model loaded successfully");
  await setupCamera(); // Start the camera once the model is loaded
  video.play();
  video.style.display = "none";
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  rCanvas.width = video.videoWidth;
  rCanvas.height = video.videoHeight;
  detectPose(); // Start detecting poses
}

// Detect pose and update the canvas with keypoints and skeleton
async function detectPose() {
  const poses = await detector.estimatePoses(video, {
    flipHorizontal: false,
    maxPoses: 1,
    scoreThreshold: 0.5,
    minPoseScore: 0.5,
    minPartScore: 0.5,
  });
  if (poses.length > 0) {
    const keypoints = poses[0].keypoints;
    drawKeypoints(keypoints); // Draw keypoints and skeleton on the canvas
    analyzeHandPositions(keypoints, video); // Analyze hand positions for clapping
  }

  requestAnimationFrame(detectPose);
}

// Draw keypoints on the main canvas
function drawKeypoints(keypoints) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  keypoints.forEach((keypoint) => {
    if (keypoint.score > 0.5) {
      const { x, y, z } = keypoint;

      // Adjust size based on z coordinate (depth)
      const size = Math.max(5 - z / 1000000, 1); // Example scaling for visibility

      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = "red"; // Color can also be adjusted based on z
      ctx.fill();
    }
  });

  drawSkeleton(keypoints);
}

// Draw skeleton from the keypoints
function drawSkeleton(keypoints) {
  const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(
    poseDetection.SupportedModels.BlazePose // Adjusted to use BlazePose
  );
  adjacentKeyPoints.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    if (kp1.score > 0.5 && kp2.score > 0.5) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.strokeStyle = "blue"; // Skeleton color
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

function drawRecKeyPoints(keypoints) {
  rCtx.clearRect(0, 0, rCanvas.width, rCanvas.height);

  keypoints.forEach((keypoint) => {
    if (keypoint.score > 0.5) {
      const { x, y, z } = keypoint;

      const size = Math.max(5 - z / 1000000, 1);

      rCtx.beginPath();
      rCtx.arc(x, y, size, 0, 2 * Math.PI);
      rCtx.fillStyle = "red"; // Color can also be adjusted based on z
      rCtx.fill();
    }
  });
  drawRecSkeleton(keypoints);
}

function drawRecSkeleton(keypoints) {
  const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(
    poseDetection.SupportedModels.BlazePose // Adjusted to use BlazePose
  );
  adjacentKeyPoints.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    if (kp1.score > 0.5 && kp2.score > 0.5) {
      rCtx.beginPath();
      rCtx.moveTo(kp1.x, kp1.y);
      rCtx.lineTo(kp2.x, kp2.y);
      rCtx.strokeStyle = "blue"; // Skeleton color
      rCtx.lineWidth = 2;
      rCtx.stroke();
    }
  });
}

function playBackRecording() {
  if (recordedKeypoints.length == 0) {
    alert("No recording avalaible to play back !");
    return;
  }

  let currentIndex = 0;
  const startTime = Date.now();

  rCtx.clearRect(0, 0, rCanvas.width, rCanvas.height);

  playbackInterval = setInterval(() => {
    const elapsedTime = Date.now() - startTime;

    while (
      currentIndex < recordedKeypoints.length &&
      recordedKeypoints[currentIndex].timeStamp <= elapsedTime
    ) {
      const { keypoints } = recordedKeypoints[currentIndex];
      drawRecKeyPoints(keypoints);
      currentIndex++;
    }

    if (currentIndex >= recordedKeypoints.length) {
      clearInterval(playbackInterval);
      canvas.style.display = "block";
      rCanvas.style.display = "none";
      console.log("Playback finished.");
    }
  }, 100);

  console.log(playbackInterval);
}

// Capture keypoints and display in the info container
captureButton.addEventListener("click", async () => {
  const poses = await detector.estimatePoses(video);
  if (poses.length > 0) {
    console.log(poses[0].keypoints);
    displayKeypoints(poses[0].keypoints);
    messagesContainer.style.display = "block";
    setTimeout(() => {
      messagesContainer.style.display = "none";
    }, 2000);
  }
});

// Display detected keypoints in the info container
function displayKeypoints(keypoints) {
  messagesContainer.innerHTML = ""; // Clear previous content
  keypoints.forEach((keypoint) => {
    if (keypoint.score > 0.5) {
      const listItem = document.createElement("li");
      listItem.textContent = `${keypoint.name}: (x: ${keypoint.x.toFixed(
        2
      )}, y: ${keypoint.y.toFixed(2)})`;
      messagesContainer.appendChild(listItem);
    }
  });
}

// Analyze hand positions and determine actions
function analyzeHandPositions(keypoints, video) {
  const hands = [
    { shoulder: "left_shoulder", wrist: "left_wrist", label: "Left Hand" },
    { shoulder: "right_shoulder", wrist: "right_wrist", label: "Right Hand" },
  ];

  let leftWrist, rightWrist;
  let leftAbove = false;
  let rightAbove = false;

  hands.forEach((hand) => {
    const shoulder = keypoints.find(
      (k) => k.name === hand.shoulder && k.score > 0.5
    );
    const wrist = keypoints.find((k) => k.name === hand.wrist && k.score > 0.5);

    if (shoulder && wrist) {
      const isAbove = determineAction([shoulder, wrist]);
      if (hand.label === "Left Hand") {
        leftAbove = isAbove; // Store whether the left hand is above
        leftWrist = wrist; // Store left wrist for clap detection
      } else {
        rightAbove = isAbove; // Store whether the right hand is above
        rightWrist = wrist; // Store right wrist for clap detection
      }
    }
  });

  // Construct message based on hand positions
  if (leftAbove && rightAbove) {
    updateDetectedObjectsList("Both hands are above shoulder");
  } else if (!leftAbove && !rightAbove) {
    updateDetectedObjectsList("Both hands are below shoulder");
  } else if (leftAbove) {
    updateDetectedObjectsList(
      "Left hand is above shoulder, Right hand is below shoulder"
    );
  } else {
    updateDetectedObjectsList(
      "Right hand is above shoulder, Left hand is below shoulder"
    );
  }

  // Check for clap detection if both wrists are available
  if (leftWrist && rightWrist) {
    const currentDistance = calculateDistance(leftWrist, rightWrist);
    checkForClap(currentDistance);
  }
}

function calculateDistance(pointA, pointB) {
  return Math.sqrt(
    Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2)
  );
}

function updateDetectedObjectsList(message) {
  // Clear previous content if necessary
  detectedObjectsList.innerHTML = "";

  // Create a new list item for the clap detection message
  const listItem = document.createElement("li");
  listItem.textContent = message;

  // Append the new item to the detected objects list
  detectedObjectsList.appendChild(listItem);
}

function checkForClap(currentDistance) {
  if (currentDistance < clapThreshold && lastDistance >= clapThreshold) {
    updateDetectedObjectsList("Clap Detected");
  }
  lastDistance = currentDistance; // Update last distance for next frame comparison
}

function determineAction([shoulder, wrist]) {
  return wrist.y < shoulder.y; // Return true if hand is above shoulder
}

const playbackButton = document.createElement("button");
playbackButton.textContent = "PlayBack";
playbackButton.addEventListener("click", playBackRecording);
btnGrid.appendChild(playbackButton);

playbackButton.addEventListener("click", () => {
  setTimeout(() => {
    canvas.style.display = "none";
    rCanvas.style.display = "block";
  }, playbackInterval);
});

function saveJson(data) {
  const jsonData = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // Create a temporary download link
  const link = document.createElement("a");
  link.href = url;
  link.download = "data.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link); // Clean up
  URL.revokeObjectURL(url);
}

main(); // Call the main function to start the app
