const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const captureButton = document.getElementById("captureBtn"); // Capture button
const infoContainer = document.getElementById("infoContainer"); // Info container to show detected objects
const detectedObjectsList = document.getElementById("detectedObjectsList");
const messagesContainer = document.getElementById("messagesContainer");

let detector;
let lastDistance = Infinity; // Initialize last distance as a large value
let clapThreshold = 150; // Distance threshold for detecting a clap

// Main function to set up the camera and load the model
async function main() {
  await loadMoveNet();
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
async function loadMoveNet() {
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet
  );
  console.log("MoveNet model loaded successfully");
  await setupCamera(); // Start the camera once the model is loaded
  video.play();
  video.style.display = "none";
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  detectPose(); // Start detecting poses
}

// Detect pose and update the canvas with keypoints and skeleton
async function detectPose() {
  const poses = await detector.estimatePoses(video);
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
      const { x, y } = keypoint;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });

  drawSkeleton(keypoints);
}

// Draw skeleton from the keypoints
function drawSkeleton(keypoints) {
  const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(
    poseDetection.SupportedModels.MoveNet
  );

  adjacentKeyPoints.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];

    if (kp1.score > 0.5 && kp2.score > 0.5) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.strokeStyle = "orange";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

// Capture keypoints and display in the info container
captureButton.addEventListener("click", async () => {
  const poses = await detector.estimatePoses(video);
  if (poses.length > 0) {
    displayKeypoints(poses[0].keypoints);
    infoContainer.style.display = "block"; // Show the info container
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

main(); // Call the main function to start the app
