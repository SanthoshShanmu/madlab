import { ElevenLabsClient } from 'elevenlabs';
// Removed dotenv as it's not needed in Edge Functions
// import dotenv from 'dotenv';
// Removed fs as it's not needed when accepting File input
// import fs from 'fs';
// Removed Readable as it's not needed when accepting File input
// import { Readable } from 'stream';

// dotenv.config(); // Removed dotenv config

const apiKey = process.env.ELEVENLABS_API_KEY; // Access API key directly from environment

if (!apiKey) {
  console.error('ELEVENLABS_API_KEY environment variable not set.');
  // In a real application, handle this more gracefully
  // process.exit(1);
}

const elevenlabsClient = new ElevenLabsClient({ apiKey });

async function textToSpeech(text: string, voiceId: string = "Sarah", modelId: string = "eleven_multilingual_v2"): Promise<Buffer> {
  console.log(`Generating speech for text: "${text}" using voice: ${voiceId}`);
  try {
    const audio = await elevenlabsClient.generate({
      voice: voiceId,
      text: text,
      model_id: modelId,
    });

    // The generate method returns a ReadableStream, convert to Buffer
    const audioBuffer = await streamToBuffer(audio);

    console.log(`Speech generated successfully.`);
    return audioBuffer;
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

// Updated speechToText to accept File as input, as received from frontend FormData in Edge Function
async function speechToText(audioFile: File): Promise<string> {
  console.log(`Transcribing audio from File object.`);
  try {
    // Call the STT API endpoint using the SDK's convert method with File input
    const transcription = await elevenlabsClient.speechToText.convert({
      file: audioFile, // Pass audio data as File
      model_id: "scribe_v1", // Model to use, for now only "scribe_v1" is support.
      tag_audio_events: true, // Tag audio events like laughter, applause, etc.
      language_code: "eng", // Language of the audio file. If set to null, the model will detect the language automatically.
      diarize: true, // Whether to annotate who is speaking
    });

    console.log(`Audio transcribed successfully.`);
    // Assuming the transcription result has a 'text' property based on documentation example
    return transcription.text;
  } catch (error) {
    console.error(`Error transcribing audio:`, error);
    throw error;
  }
}

// Helper function to convert a ReadableStream to a Buffer
// This helper is still needed for the textToSpeech function
async function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}


export {
  textToSpeech,
  speechToText,
};
