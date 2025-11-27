import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Validate that image_base64 is provided
        if (!body.image_base64) {
            return NextResponse.json(
                { error: "Missing image_base64 in request body" },
                { status: 400 }
            );
        }

        console.log("Making prediction request to:", process.env.DISEASE_API_URL);
        console.log("Request body keys:", Object.keys(body));

        const response = await axios.post(
            process.env.DISEASE_API_URL!,
            body,
            {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 30000, // 30 second timeout
            }
        );
        
        return NextResponse.json(response.data);
    } catch (error) {
        console.error("Error processing prediction:", error);
        
        // More detailed error logging
        if (axios.isAxiosError(error)) {
            console.error("Axios error details:", {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers,
                }
            });
            
            return NextResponse.json(
                { 
                    error: "External API request failed", 
                    details: error.message,
                    status: error.response?.status,
                    apiResponse: error.response?.data
                },
                { status: error.response?.status || 500 }
            );
        }
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Failed to process prediction", details: errorMessage },
            { status: 500 }
        );
    }
}