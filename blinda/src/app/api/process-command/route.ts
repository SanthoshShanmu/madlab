import { NextResponse, NextRequest } from "next/server"; // Import NextRequest
// Removed OpenAI import
// import OpenAI from "openai";
import { createAzure } from '@ai-sdk/azure'; // Corrected import path for createAzure

// Serverless Function runtime (default for Next.js API routes)
// export const runtime = "nodejs"; // This is the default, can be omitted

// Initialize Azure OpenAI client using Vercel AI SDK
const azure = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME!, // Azure resource name from .env.local
  apiKey: process.env.AZURE_API_KEY!, // Azure API key from .env.local
});


export async function POST(req: NextRequest) { // Change Request to NextRequest
  try {
    const { transcribedText, sessionId } = await req.json();

    if (!transcribedText) {
      return NextResponse.json({ error: "No transcribed text provided." }, { status: 400 });
    }

    console.log(`Received transcribed text: "${transcribedText}" for session: ${sessionId}`);

    // --- Step 1: Formulate CUA task from transcribed text (Simplified for POC) ---
    // For the POC, we'll assume the transcribed text is a direct command or URL.
    // In a full implementation, an LLM would interpret complex commands.
    let cuaTask = { task: transcribedText }; // Default to using the text as the task

    // Basic check if the text looks like a URL to formulate a navigation task
    try {
        const url = new URL(transcribedText);
        // If parsing succeeds, assume it's a navigation task
        cuaTask = { task: `Navigate to ${url.toString()}` };
    } catch (e) {
        // Not a valid URL, keep the text as the task
        console.log(`Transcribed text "${transcribedText}" is not a URL, using as direct task.`);
    }


    // --- Step 2: Call Hyperbrowser/CUA Serverless Function ---
    console.log(`Calling /api/browse with task: ${JSON.stringify(cuaTask)} and session ID: ${sessionId}`);
    const browseResponse = await fetch(`${req.nextUrl.origin}/api/browse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskDescription: cuaTask.task, sessionId }),
    });

    if (!browseResponse.ok) {
      const errorText = await browseResponse.text();
      throw new Error(`Hyperbrowser API error! status: ${browseResponse.status}, body: ${errorText}`);
    }

    const browseResult = await browseResponse.json();
    const updatedSessionId = browseResult.sessionId; // Get the potentially new session ID
    const cuaOutput = browseResult; // The whole result is the 'what it sees'


    // --- Step 3: Use LLM to interpret CUA output and generate user-friendly text ---
    console.log("Using LLM to interpret CUA output using Azure OpenAI...");
    // For the POC, we'll send the raw CUA output to the LLM.
    // In a full implementation, we might pre-process the CUA output.
    const llmResponse = await azure.chat.completions.create({ // Use azure client
      model: "gpt-4o-mini", // Or another suitable model deployed on Azure
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that helps blind users understand web pages. Describe the key elements and available actions on the page based on the provided technical output from a browser agent. Be concise and focus on interactive elements. End your response by asking the user what they want to do next.",
        },
        {
          role: "user",
          content: `Browser state after executing task "${transcribedText}":\n\n${JSON.stringify(cuaOutput, null, 2)}`,
        },
      ],
    });

    const userFriendlyText = llmResponse.choices[0]?.message?.content || "Could not interpret the page.";
    console.log(`Generated user-friendly text: "${userFriendlyText}"`);


    // --- Step 4: Call Eleven Labs TTS Edge Function ---
    console.log(`Calling /api/tts with text: "${userFriendlyText}"`);
    const ttsResponse = await fetch(`${req.nextUrl.origin}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: userFriendlyText }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      throw new Error(`Eleven Labs TTS API error! status: ${ttsResponse.status}, body: ${errorText}`);
    }

    // --- Step 5: Stream audio back to frontend ---
    // The /api/tts route returns an audio stream directly.
    // We can return this stream directly from this Serverless Function.
    console.log("Streaming audio back to frontend.");
    return new Response(ttsResponse.body, {
      headers: {
        'Content-Type': 'audio/mpeg', // Or the appropriate audio MIME type from /api/tts response headers
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    console.error("Error processing command:", error);
    // TODO: Generate auditory error feedback for the user
    return NextResponse.json({ message: "Error processing command", error: (error as Error).message }, { status: 500 });
  }
}
