import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";

export const runtime = "edge"; // Specify the Edge runtime

export async function POST(req: Request) {
  try {
    const { text, voiceId, modelId } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided for TTS." }, { status: 400 });
    }

    // Initialize the Eleven Labs client
    // The API key should be available as an environment variable in Vercel
    const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! }); // Use non-null assertion as it's required

    // Call the Text-to-Speech generation method
    const audioStream = await client.generate({
      voice: voiceId || "Sarah", // Use provided voiceId or default
      text: text,
      model_id: modelId || "eleven_multilingual_v2", // Use provided modelId or default
    });

    // Return the audio stream
    return new Response(audioStream as any, { // Cast to any to satisfy Response constructor type
      headers: {
        'Content-Type': 'audio/mpeg', // Or the appropriate audio MIME type
      },
    });

  } catch (error) {
    console.error("Error generating speech:", error);
    return NextResponse.json({ message: "Error generating speech", error: (error as Error).message }, { status: 500 });
  }
}
