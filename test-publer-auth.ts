import fetch from "node-fetch";
import FormData from "form-data";

const PUBLER_API_KEY = process.env.PUBLER_API_KEY || "838f5909c0dbb6a197bb7daeae8aca46da61827dc8e1d256";
const PUBLER_WORKSPACE_ID = process.env.PUBLER_WORKSPACE_ID || "67f2f1b5a0d8d5f9a8e6c9d0";

console.log("Testing Publer API Authentication...\n");
console.log("API Key:", PUBLER_API_KEY ? `${PUBLER_API_KEY.substring(0, 10)}...` : "NOT SET");
console.log("Workspace ID:", PUBLER_WORKSPACE_ID || "NOT SET");
console.log("\n" + "=".repeat(60) + "\n");

async function testPublerAuth() {
  try {
    // Test 1: List accounts
    console.log("Test 1: Listing accounts...");
    const accountsResponse = await fetch("https://app.publer.com/api/v1/accounts", {
      method: "GET",
      headers: {
        "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
        "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
      },
    });

    console.log("Status:", accountsResponse.status, accountsResponse.statusText);
    const accountsText = await accountsResponse.text();
    console.log("Response:", accountsText.substring(0, 1000));
    console.log("\n" + "=".repeat(60) + "\n");

    // Test 2: Try to upload a simple test image
    console.log("Test 2: Testing media upload endpoint...");
    
    // Create a minimal test image (1x1 red pixel PNG)
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
    const buffer = Buffer.from(testImageBase64, "base64");

    const form = new FormData();
    form.append("file", buffer, {
      filename: "test.png",
      contentType: "image/png",
    });

    const uploadResponse = await fetch("https://app.publer.com/api/v1/media", {
      method: "POST",
      headers: {
        "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
        "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
        ...form.getHeaders(),
      },
      body: form,
    });

    console.log("Status:", uploadResponse.status, uploadResponse.statusText);
    const uploadText = await uploadResponse.text();
    console.log("Response:", uploadText);

  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

testPublerAuth();
