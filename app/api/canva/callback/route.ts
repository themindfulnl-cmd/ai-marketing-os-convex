import { NextRequest, NextResponse } from "next/server";

/**
 * Canva OAuth Callback Handler
 * 
 * Receives the authorization code from Canva and exchanges it for tokens
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
        console.error("Canva OAuth error:", error);
        return NextResponse.redirect(
            new URL(`/planner?error=${encodeURIComponent(error)}`, request.url)
        );
    }

    if (!code || !state) {
        return NextResponse.redirect(
            new URL("/planner?error=missing_params", request.url)
        );
    }

    try {
        // Call the Convex action to exchange the token
        // In production, this would be a server-side call
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

        // Redirect to planner with success message
        // The actual token exchange will happen client-side via Convex
        return NextResponse.redirect(
            new URL(
                `/planner?canva_code=${encodeURIComponent(code)}&canva_state=${encodeURIComponent(state)}`,
                request.url
            )
        );
    } catch (err: any) {
        console.error("Token exchange failed:", err);
        return NextResponse.redirect(
            new URL(`/planner?error=${encodeURIComponent(err.message)}`, request.url)
        );
    }
}
