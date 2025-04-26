"use client"; // This is a client component

import { useState, useRef } from "react";
import Image from "next/image";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); // Use wav for better compatibility
      console.log("Recorded audio blob:", audioBlob);
      sendAudioForTranscription(audioBlob); // Call the function to send the audio
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
    setAudioBlob(null); // Clear previous recording
  } catch (error) {
    console.error("Error accessing microphone:", error);
    // TODO: Provide auditory error feedback for microphone access error
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
  formData.append('audio', audioBlob, 'recording.wav'); // Append the blob as a file

  try {
    const response = await fetch('/api/transcribe', { // Call the Edge Function API route
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    console.log("Transcription result:", result);
    // Send the transcription result to the orchestration Serverless Function
    processCommand(result.transcription); // Call the function to process the command

  } catch (error) {
    console.error("Error sending audio for transcription:", error);
    // TODO: Provide auditory feedback for the error
  }
};

const processCommand = async (transcribedText: string) => {
  console.log(`Processing command: "${transcribedText}"`);
  // TODO: Manage session ID state in the frontend or pass it back and forth
  const sessionId = null; // Placeholder for session ID

  try {
    const response = await fetch('/api/process-command', { // Call the orchestration Serverless Function
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcribedText, sessionId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Command processing error! status: ${response.status}, body: ${errorText}`);
    }

    // The response body is the audio stream from the TTS Edge Function
    const audioBlob = await response.blob();
    console("Received audio blob from backend.");
    // Play the audio blob
    playAudio(audioBlob);

  } catch (error) {
    console.error("Error processing command:", error);
    // TODO: Provide auditory error feedback
  }
};

const playAudio = (audioBlob: Blob) => {
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
  audio.onended = () => {
    URL.revokeObjectURL(audioUrl); // Clean up the object URL after playback
  };
};


return (
  <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
    <header className="row-start-1 flex flex-col items-center">
      <h1 className="text-2xl font-bold">Blinda - Context-Aware Navigation Agent</h1>
    </header>

    <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
      <p className="text-lg">Interact with the web using your voice.</p>

      <div className="flex gap-4 items-center">
        {!isRecording ? (
          <button
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-green-500 text-white gap-2 hover:bg-green-600 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            onClick={startRecording}
          >
            Start Recording
          </button>
        ) : (
          <button
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-red-500 text-white gap-2 hover:bg-red-600 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            onClick={stopRecording}
          >
            Stop Recording
          </button>
        )}
      </div>

      {/* Removed audioBlob display as per user feedback */}
      {/*
      {audioBlob && (
        <div className="mt-4">
          <p>Audio recorded. Ready to send for transcription.</p>
        </div>
      )}
      */}

      {/* Original content - can be removed or modified later */}
      {/*
      <Image
        className="dark:invert"
        src="/next.svg"
        alt="Next.js logo"
        width={180}
        height={38}
        priority
      />
      <ol className="list-inside list-decimal text-sm/6 text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
        <li className="mb-2 tracking-[-.01em]">
          Get started by editing{" "}
          <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-[family-name:var(--font-geist-mono)] font-semibold">
            src/app/page.tsx
          </code>
          .
        </li>
        <li className="tracking-[-.01em]">
          Save and see your changes instantly.
        </li>
      </ol>

      <div className="flex gap-4 items-center flex-col sm:flex-row">
        <a
          className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
          href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            className="dark:invert"
            src="/vercel.svg"
            alt="Vercel logomark"
            width={20}
            height={20}
          />
          Deploy now
        </a>
        <a
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
          href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read our docs
        </a>
      </div>
      */}
    </main>
    <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
      {/* Original footer content - can be removed or modified later */}
      {/*
      <a
        className="flex items-center gap-2 hover:underline hover:underline-offset-4"
        href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          aria-hidden
          src="/file.svg"
          alt="File icon"
          width={16}
          height={16}
        />
        Learn
      </a>
      <a
        className="flex items-center gap-2 hover:underline hover:underline-offset-4"
        href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
        target="_blank"
        rel="noopener noreferrer"
      >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
        */}
    </footer>
  </div>
);
}
