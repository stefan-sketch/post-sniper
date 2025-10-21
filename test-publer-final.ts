import fetch from "node-fetch";
import FormData from "form-data";

const PUBLER_API_KEY = process.env.PUBLER_API_KEY || "838f5909c0dbb6a197bb7daeae8aca46da61827dc8e1d256";
const PUBLER_WORKSPACE_ID = process.env.PUBLER_WORKSPACE_ID || "681c97fbf125221fac48ca88";

console.log("Testing Publer API with Correct Workspace ID...\n");
console.log("API Key:", PUBLER_API_KEY ? `${PUBLER_API_KEY.substring(0, 10)}...` : "NOT SET");
console.log("Workspace ID:", PUBLER_WORKSPACE_ID);
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
    
    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json();
      console.log("\n✅ SUCCESS! Found", Array.isArray(accountsData) ? accountsData.length : 0, "accounts");
      console.log("\nAccounts:");
      if (Array.isArray(accountsData)) {
        accountsData.forEach((account: any, index: number) => {
          console.log(`  ${index + 1}. ${account.name || 'Unnamed'} (${account.network || 'unknown'}) - ID: ${account.id}`);
        });
      }
    } else {
      const errorText = await accountsResponse.text();
      console.log("❌ Error:", errorText);
    }
    
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
    
    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      console.log("\n✅ SUCCESS! Media uploaded");
      console.log("Media ID:", uploadData.id);
      console.log("Media URL:", uploadData.path || uploadData.url);
    } else {
      const uploadText = await uploadResponse.text();
      console.log("❌ Error:", uploadText);
    }

  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

testPublerAuth();
