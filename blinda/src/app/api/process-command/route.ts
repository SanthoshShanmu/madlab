import { NextResponse, NextRequest } from "next/server";
import { createAzure } from '@ai-sdk/azure';
import { generateText } from 'ai';

// Initialize Azure OpenAI client using Vercel AI SDK
const azureModel = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME!,
  apiKey: process.env.AZURE_API_KEY!,
})('gpt-4o-mini'); // Use your deployment name here

export async function POST(req: NextRequest) {
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
    const { text: userFriendlyText } = await generateText({
      model: azureModel,
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that helps blind users understand web pages. Describe the key elements and available actions on the page based on the provided technical output from a browser agent. Be concise and focus on interactive elements. End your response by asking the user what they want to do next."
        },
        {
          role: "user",
          content: `Browser state after executing task "${transcribedText}":\n\n${JSON.stringify(cuaOutput, null, 2)}`
        }
      ]
    });

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

    // --- Step 5: Stream audio back to frontend with the session ID in headers ---
    console.log("Streaming audio back to frontend with session ID:", updatedSessionId);
    
    // Create headers with the session ID
    const headers = new Headers({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'x-session-id': updatedSessionId || '', // Include the session ID in the response headers
    });
    
    return new Response(ttsResponse.body, { headers });

  } catch (error) {
    console.error("Error processing command:", error);
    // TODO: Generate auditory error feedback for the user
    return NextResponse.json({ message: "Error processing command", error: (error as Error).message }, { status: 500 });
  }
}
