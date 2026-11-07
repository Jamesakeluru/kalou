const memoryGrid = document.getElementById("memory-grid");
const celebrateButton = document.getElementById("celebrate-button");
const celebrationMessage = document.getElementById("celebration-message");
const audioToggle = document.getElementById("audio-toggle");
const birthdayEntry = document.getElementById("birthday-entry");
const birthdayEntryLink = document.getElementById("birthday-entry-link");
const audioLabel = audioToggle.querySelector(".audio-label");
const musicStatus = document.getElementById("music-status");
const birthdayMusic = document.getElementById("birthday-music");
const birthdayTracks = ["media/track-one.mp3", "media/track-two.mp3"];
const videoAudioTracks = new WeakMap();
let musicPlaying = false;
let musicEnabled = true;
let resumeAfterVideo = false;
let currentBirthdayTrack = 0;

function updateMusicStatus(message, visible = false) {
  musicStatus.textContent = message;
  musicStatus.hidden = !visible;
}

function hasPlayingVideo() {
  return Array.from(memoryGrid.querySelectorAll("video")).some((video) => !video.paused && !video.ended);
}

function configureVideoAudio(video) {
  const hasSeparateAudio = videoAudioTracks.has(video);
  video.muted = hasSeparateAudio;
  video.defaultMuted = hasSeparateAudio;
  video.volume = 1;
}

function useOriginalVideoAudio(video, message) {
  const track = videoAudioTracks.get(video);
  const soundEnabled = track ? !track.muted : true;
  track?.pause();
  videoAudioTracks.delete(video);
  video.defaultMuted = !soundEnabled;
  video.muted = !soundEnabled;
  const button = video.closest(".memory-card")?.querySelector(".video-audio-toggle");
  if (button) {
    button.hidden = true;
  }
  updateMusicStatus(message, true);
}

function syncVideoAudio(video, play = false) {
  const track = videoAudioTracks.get(video);
  if (!track) {
    configureVideoAudio(video);
    return;
  }

  if (track.readyState > 0 && Math.abs(track.currentTime - video.currentTime) > 0.25) {
    track.currentTime = video.currentTime;
  }
  track.playbackRate = video.playbackRate;

  if (play && track.paused) {
    track.play().catch((error) => {
      if (error.name === "AbortError" && (track.paused || video.paused)) {
        return;
      }
      console.error("Could not play the video’s separate audio track.", error);
      useOriginalVideoAudio(video, "The separate clip audio could not start; using the original video sound instead.");
    });
  }
}

memoryGrid.querySelectorAll("video").forEach((video) => {
  if (video.dataset.audioSource) {
    const track = new Audio(video.dataset.audioSource);
    track.preload = "auto";
    track.volume = 1;
    videoAudioTracks.set(video, track);
    track.addEventListener("loadedmetadata", () => {
      syncVideoAudio(video, !video.paused);
    });
    track.addEventListener("error", () => {
      useOriginalVideoAudio(video, "The separate clip audio could not load; using the original video sound instead.");
    });
  }

  configureVideoAudio(video);
});

memoryGrid.addEventListener("play", (event) => {
  if (event.target instanceof HTMLVideoElement) {
    configureVideoAudio(event.target);
    memoryGrid.querySelectorAll("video").forEach((video) => {
      if (video !== event.target && !video.paused) {
        video.pause();
      }
    });
    syncVideoAudio(event.target, true);
    if (musicEnabled) {
      resumeAfterVideo = true;
    }
    pauseBirthdayMusic();
  }
}, true);

function resumeMusicAfterVideo() {
  if (resumeAfterVideo && musicEnabled && !hasPlayingVideo()) {
    resumeAfterVideo = false;
    startBirthdayMusic();
  }
}

memoryGrid.addEventListener("pause", (event) => {
  if (event.target instanceof HTMLVideoElement) {
    const track = videoAudioTracks.get(event.target);
    if (track) {
      track.pause();
      syncVideoAudio(event.target);
    }
    resumeMusicAfterVideo();
  }
}, true);

memoryGrid.addEventListener("ended", (event) => {
  if (event.target instanceof HTMLVideoElement) {
    const track = videoAudioTracks.get(event.target);
    if (track) {
      track.pause();
      track.currentTime = 0;
    }
    resumeMusicAfterVideo();
  }
}, true);

memoryGrid.addEventListener("seeking", (event) => {
  if (event.target instanceof HTMLVideoElement) {
    syncVideoAudio(event.target);
  }
}, true);

memoryGrid.addEventListener("seeked", (event) => {
  if (event.target instanceof HTMLVideoElement) {
    syncVideoAudio(event.target, !event.target.paused);
  }
}, true);

memoryGrid.addEventListener("ratechange", (event) => {
  if (event.target instanceof HTMLVideoElement) {
    syncVideoAudio(event.target);
  }
}, true);

memoryGrid.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest(".video-audio-toggle");
  if (!button) {
    return;
  }

  const video = button.closest(".memory-card")?.querySelector("video");
  const track = video && videoAudioTracks.get(video);
  if (!video || !track) {
    return;
  }

  track.muted = !track.muted;
  const label = button.querySelector("span:last-child");
  button.setAttribute("aria-pressed", String(!track.muted));
  button.setAttribute("aria-label", track.muted ? "Enable video sound" : "Mute video sound");
  label.textContent = track.muted ? "Sound off" : "Sound on";
  syncVideoAudio(video, !video.paused && !track.muted);
}, true);

birthdayMusic.addEventListener("ended", () => {
  currentBirthdayTrack = (currentBirthdayTrack + 1) % birthdayTracks.length;
  birthdayMusic.src = birthdayTracks[currentBirthdayTrack];
  birthdayMusic.load();
  musicPlaying = false;
  if (musicEnabled && !hasPlayingVideo()) {
    startBirthdayMusic();
  }
});

async function toggleBirthdayMusic() {
  if (musicPlaying) {
    musicEnabled = false;
    resumeAfterVideo = false;
    pauseBirthdayMusic(true);
    return;
  }

  musicEnabled = true;
  await startBirthdayMusic();
}

function pauseBirthdayMusic(explicitlyPaused = false) {
  if (!musicPlaying && birthdayMusic.paused) {
    return;
  }

  birthdayMusic.pause();
  musicPlaying = false;
  audioToggle.setAttribute("aria-pressed", "false");
  audioToggle.setAttribute("aria-label", musicEnabled ? "Resume birthday playlist" : "Play birthday playlist");
  audioLabel.textContent = musicEnabled ? "Playlist paused for video" : "Play birthday playlist";
  updateMusicStatus(explicitlyPaused
    ? "Birthday playlist paused."
    : "Birthday playlist paused while your video plays.");
}

async function startBirthdayMusic() {
  if (!musicEnabled || hasPlayingVideo() || musicPlaying) {
    return;
  }

  try {
    await birthdayMusic.play();
    if (!musicEnabled || hasPlayingVideo()) {
      birthdayMusic.pause();
      return;
    }

    musicPlaying = true;
    audioToggle.setAttribute("aria-pressed", "true");
    audioToggle.setAttribute("aria-label", "Pause birthday playlist");
    audioLabel.textContent = "Pause playlist";
    updateMusicStatus("Kalou’s birthday playlist is playing. Tap again to pause.");
  } catch (error) {
    if (error.name === "NotAllowedError") {
      audioToggle.setAttribute("aria-pressed", "false");
      audioToggle.setAttribute("aria-label", "Enable birthday playlist");
      audioLabel.textContent = "Tap to play playlist";
      updateMusicStatus("Your browser blocked autoplay. Tap the music button to start the playlist.", true);
      return;
    }

    if (error.name === "AbortError") {
      return;
    }

    console.error("Could not start the birthday playlist.", error);
    updateMusicStatus("The birthday playlist could not play. Check that the audio files are available.", true);
  }
}

audioToggle.addEventListener("click", toggleBirthdayMusic);
birthdayEntryLink.addEventListener("click", () => {
  musicEnabled = true;
  startBirthdayMusic();
  birthdayEntry.hidden = true;
});

celebrateButton.addEventListener("click", () => {
  celebrationMessage.textContent = "May this be your happiest year yet. Happy birthday, my love!";
  celebrateButton.disabled = true;
  celebrateButton.setAttribute("aria-describedby", "celebration-message");

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const colors = ["#d98787", "#e7bb72", "#8b6680", "#fff4df"];

    for (let index = 0; index < 48; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.setAttribute("aria-hidden", "true");
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.backgroundColor = colors[index % colors.length];
      piece.style.setProperty("--drift", `${Math.random() * 180 - 90}px`);
      piece.style.animationDelay = `${Math.random() * 0.6}s`;
      document.body.append(piece);
      piece.addEventListener("animationend", () => piece.remove(), { once: true });
    }
  }
});

window.addEventListener("pagehide", () => {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  window.clearInterval(musicTimer);
  window.clearTimeout(pauseTimer);
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }
});
