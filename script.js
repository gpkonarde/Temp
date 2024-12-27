const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const captureButton = document.getElementById("captureBtn"); // Capture button
const infoContainer = document.getElementById("infoContainer"); // Info container to show detected objects
const detectedObjectsList = document.getElementById("detectedObjectsList");

let detector;
let keypointsData = [];

// Setup the camera stream
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function switchCamera() {
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: currentFacingMode },
  });

  // Stop the current video stream
  const tracks = video.srcObject.getTracks();
  tracks.forEach((track) => track.stop());

  // Set the new stream
  video.srcObject = stream;
  video.play();
  detectPose(); // Restart pose detection
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
      ctx.strokeStyle = "blue";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

// Detect pose and update the canvas with keypoints and skeleton
async function detectPose() {
  const poses = await detector.estimatePoses(video);
  if (poses.length > 0) {
    drawKeypoints(poses[0].keypoints); // Draw keypoints and skeleton on the canvas
  }
  //   document.getElementById("webcam").style.display = none;
  requestAnimationFrame(detectPose);
}

// Capture keypoints and display in the info container
captureButton.addEventListener("click", async () => {
  const poses = await detector.estimatePoses(video);
  if (poses.length > 0) {
    const keypoints = poses[0].keypoints;

    // Clear previous content
    detectedObjectsList.innerHTML = "";

    // Iterate over the keypoints and add the body parts with their coordinates to the list
    keypoints.forEach((keypoint) => {
      if (keypoint.score > 0.5) {
        const listItem = document.createElement("li");
        listItem.textContent = `${keypoint.name}: (x: ${keypoint.x.toFixed(
          2
        )}, y: ${keypoint.y.toFixed(2)})`;
        detectedObjectsList.appendChild(listItem);
      }
    });

    // Show the info container
    infoContainer.style.display = "block";
  }
});

// Main function to set up the camera and load the model
async function main() {
  await loadMoveNet();
}

main(); // Call the main function to start the app
