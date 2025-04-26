import { NextResponse } from "next/server";
import { Hyperbrowser } from "@hyperbrowser/sdk";
// Removed dotenv as it's not needed in Serverless Functions
// import dotenv from 'dotenv';

// Serverless Function runtime (default for Next.js API routes unless specified 'edge')
// export const runtime = "nodejs"; // This is the default, can be omitted

// dotenv.config(); // Removed dotenv config

const apiKey = process.env.HYPERBROWSER_API_KEY; // Access API key directly from environment

if (!apiKey) {
  console.error('HYPERBROWSER_API_KEY environment variable not set.');
  // In a real application, handle this more gracefully
  // process.exit(1);
}

const hyperbrowserClient = new Hyperbrowser({ apiKey });

export async function POST(req: Request) {
  try {
    const { taskDescription, sessionId: incomingSessionId } = await req.json();

    if (!taskDescription) {
      return NextResponse.json({ error: "No task description provided." }, { status: 400 });
    }

    let currentSessionId = incomingSessionId;

    // If no session ID is provided, create a new session
    if (!currentSessionId) {
      console.log("No session ID provided, creating a new Hyperbrowser session.");
      const newSession = await hyperbrowserClient.sessions.create({
        solveCaptchas: true, // Enable captcha solving on session creation
        useStealth: true, // Enable stealth mode on session creation
      });
      currentSessionId = newSession.id;
      console.log(`New session created with ID: ${currentSessionId}`);
    } else {
      console.log(`Reusing session with ID: ${currentSessionId}`);
      // Optional: Add logic here to verify the session is still active if needed
    }

    // Execute the CUA task using Hyperbrowser
    // Pass the task description and the current session ID
    const result = await hyperbrowserClient.agents.cua.startAndWait({
      task: taskDescription,
      sessionId: currentSessionId,
      keepBrowserOpen: true, // Keep session open after tasks
      // Use the current session ID
      // Options like solveCaptchas, useStealth, keepBrowserOpen are set on session creation
    });

    // Return the result from the CUA task, including the session ID for reuse
    // The result will contain information about the browser state ('what it sees')
    return NextResponse.json({ ...result, sessionId: currentSessionId });

  } catch (error) {
    console.error("Error executing Hyperbrowser task:", error);
    // If the error is due to an invalid or expired session, the frontend should handle it
    // by starting a new session on the next request.
    return NextResponse.json({ message: "Error executing Hyperbrowser task", error: (error as Error).message }, { status: 500 });
  }
}
