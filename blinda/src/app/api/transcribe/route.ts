import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
// Removed Readable import as it's not needed when accepting File input in Edge Function
// import { Readable } from "stream"; // Readable is available in the Edge runtime

export const runtime = "edge"; // Specify the Edge runtime

export async function POST(req: Request) {
  try {
    // Parse the incoming FormData
    const form = await req.formData();
    const file = form.get("audio") as File; // 'audio' must match the append name in the frontend FormData

    if (!file) {
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }

    // Initialize the Eleven Labs client
    // The API key should be available as an environment variable in Vercel
    const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! }); // Use non-null assertion as it's required

    // Call the Speech-to-Text conversion method
    // The Eleven Labs SDK's convert method in the Edge runtime expects a File object directly
    const transcription = await client.speechToText.convert({
      file: file, // Pass the File object directly
      model_id: "scribe_v1", // Use the specified model
      // Add other optional parameters as needed based on documentation
      // tag_audio_events: true,
      // language_code: "eng",
      diarize: true, // Enable diarization as per the guide
    });

    // Return the transcription result
    return NextResponse.json(transcription);

  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json({ message: "Error transcribing audio", error: (error as Error).message }, { status: 500 });
  }
}
