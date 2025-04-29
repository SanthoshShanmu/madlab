"use client"; // This is a client component

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null); // Add session ID state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null); // Add reference for audio player

  // Load session ID from localStorage on component mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('hyperbrowser_session_id');
    if (savedSessionId) {
      console.log(`Loaded saved session ID: ${savedSessionId}`);
      setSessionId(savedSessionId);
    }
  }, []);

  const startRecording = async () => {
    // Stop any playing audio first
    stopAudio();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        console.log("Recorded audio blob:", audioBlob);
        sendAudioForTranscription(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAudioBlob(null); // Clear previous recording
    } catch (error) {
      console.error("Error accessing microphone:", error);
      // TODO: Provide auditory error feedback for microphone access error
    }
  };

  // Add function to stop audio playback
  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      console.log("Audio playback interrupted");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioForTranscription = async (audioBlob: Blob) => {
    console.log("Sending audio for transcription...");
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json();
      console.log("Transcription result:", result);
      processCommand(result.text);
    } catch (error) {
      console.error("Error sending audio for transcription:", error);
      // TODO: Provide auditory feedback for the error
    }
  };

  const processCommand = async (transcribedText: string) => {
    console.log(`Processing command: "${transcribedText}" with session ID: ${sessionId}`);
    
    try {
      const response = await fetch('/api/process-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcribedText, sessionId }), // Send current session ID
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Command processing error! status: ${response.status}, body: ${errorText}`);
      }

      // The response body is the audio stream from the TTS Edge Function
      const audioBlob = await response.blob();
      console.log("Received audio blob from backend.");
      
      // Get the updated session ID from headers if available
      const updatedSessionId = response.headers.get('x-session-id');
      if (updatedSessionId) {
        console.log(`Received updated session ID: ${updatedSessionId}`);
        setSessionId(updatedSessionId);
        localStorage.setItem('hyperbrowser_session_id', updatedSessionId); // Save to localStorage
      }
      
      // Play the audio blob
      playAudio(audioBlob);
    } catch (error) {
      console.error("Error processing command:", error);
      // TODO: Provide auditory error feedback
    }
  };

  const playAudio = (audioBlob: Blob) => {
    // Stop any currently playing audio
    stopAudio();
    
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audioPlayerRef.current = audio; // Store reference for interruption
    
    audio.play();
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      audioPlayerRef.current = null;
    };
  };

  // Add keyboard shortcut to stop audio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space key interrupts audio, Escape key stops recording
      if (e.key === ' ' && !isRecording) {
        stopAudio();
        e.preventDefault(); // Prevent page scrolling
      } else if (e.key === 'Escape' && isRecording) {
        stopRecording();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecording]);

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="row-start-1 flex flex-col items-center">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500 py-2">
          Blinda - Context-Aware Navigation Agent
        </h1>
      </header>

      <main className="flex flex-col gap-[32px] row-start-2 items-center w-full max-w-md mx-auto">
        <div className="bg-white dark:bg-slate-800 shadow-lg rounded-xl p-8 w-full border border-slate-200 dark:border-slate-700">
          <p className="text-lg text-center mb-8 text-slate-700 dark:text-slate-300">
            Interact with the web using your voice.
          </p>

          <div className="flex justify-center">
            {!isRecording ? (
              <button
                className="rounded-full border-2 border-solid border-transparent transition-all duration-300 flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600 text-white gap-2 hover:shadow-lg hover:scale-105 font-medium text-sm sm:text-base h-12 sm:h-14 px-6 sm:px-8 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                onClick={startRecording}
              >
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Start Recording
                </span>
              </button>
            ) : (
              <button
                className="rounded-full border-2 border-solid border-transparent transition-all duration-300 flex items-center justify-center bg-gradient-to-r from-red-500 to-rose-600 text-white gap-2 hover:shadow-lg hover:scale-105 font-medium text-sm sm:text-base h-12 sm:h-14 px-6 sm:px-8 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 animate-pulse"
                onClick={stopRecording}
              >
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  Stop Recording
                </span>
              </button>
            )}
          </div>

          {/* Add a stop audio button */}
          {audioPlayerRef.current && !isRecording && (
            <div className="mt-4 flex justify-center">
              <button
                className="rounded-full border-2 border-solid border-transparent transition-all duration-300 flex items-center justify-center bg-gradient-to-r from-amber-500 to-orange-600 text-white gap-2 hover:shadow-lg font-medium text-sm h-10 px-4 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50"
                onClick={stopAudio}
              >
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V9a1 1 0 00-1-1H7z" clipRule="evenodd" />
                  </svg>
                  Stop Audio (Press Space)
                </span>
              </button>
            </div>
          )}
          
          {/* Show session ID if available */}
          {sessionId && (
            <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Session active: {sessionId.substring(0, 8)}...
            </div>
          )}
        </div>
      </main>
      
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
        <p>© {new Date().getFullYear()} Blinda</p>
      </footer>
    </div>
  );
}
